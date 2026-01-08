import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useLaundryDeliverySchedule, DeliverySchedule } from '@/hooks/useLaundrySchedule';
import { Settings, Truck, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LaundryScheduleConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface ScheduleRowProps {
  schedule: DeliverySchedule;
  onUpdate: (id: string, collectionDays: number[], isActive: boolean) => void;
  isUpdating: boolean;
}

const ScheduleRow = ({ schedule, onUpdate, isUpdating }: ScheduleRowProps) => {
  const [localCollectionDays, setLocalCollectionDays] = useState<number[]>(schedule.collectionDays);
  const [localIsActive, setLocalIsActive] = useState(schedule.isActive);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const collectionChanged = 
      JSON.stringify(localCollectionDays.sort()) !== JSON.stringify(schedule.collectionDays.sort());
    const activeChanged = localIsActive !== schedule.isActive;
    setHasChanges(collectionChanged || activeChanged);
  }, [localCollectionDays, localIsActive, schedule]);

  const toggleCollectionDay = (day: number) => {
    setLocalCollectionDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSave = () => {
    onUpdate(schedule.id, localCollectionDays, localIsActive);
    setHasChanges(false);
  };

  // Get valid collection days (days before the delivery day)
  const getValidCollectionDays = (): number[] => {
    const result: number[] = [];
    // For each day, check if it's before the delivery day in the week
    for (let i = 0; i < 7; i++) {
      if (i !== schedule.dayOfWeek) {
        result.push(i);
      }
    }
    return result;
  };

  const validDays = getValidCollectionDays();

  return (
    <Card className={cn(
      "transition-all",
      !localIsActive && "opacity-60",
      hasChanges && "ring-2 ring-primary/50"
    )}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              localIsActive ? "bg-primary/10" : "bg-muted"
            )}>
              <Truck className={cn(
                "h-5 w-5",
                localIsActive ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <h3 className="font-semibold">{schedule.name}</h3>
              <p className="text-xs text-muted-foreground">
                Reparto los {DAY_NAMES[schedule.dayOfWeek]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`active-${schedule.id}`} className="text-sm text-muted-foreground">
              Activo
            </Label>
            <Switch
              id={`active-${schedule.id}`}
              checked={localIsActive}
              onCheckedChange={setLocalIsActive}
            />
          </div>
        </div>

        {/* Collection Days Selector */}
        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Recoge servicios de:
          </Label>
          <div className="flex flex-wrap gap-2">
            {validDays.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => toggleCollectionDay(day)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  localCollectionDays.includes(day)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {DAY_NAMES_SHORT[day]}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {localCollectionDays.length > 0 && (
          <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-3">
            <span className="text-muted-foreground">Servicios de</span>
            <div className="flex items-center gap-1">
              {localCollectionDays.map((day, i) => (
                <span key={day}>
                  <Badge variant="outline" className="text-xs">
                    {DAY_NAMES_SHORT[day]}
                  </Badge>
                  {i < localCollectionDays.length - 1 && <span className="mx-1">+</span>}
                </span>
              ))}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />
            <span className="font-medium">Entrega {DAY_NAMES[schedule.dayOfWeek]}</span>
          </div>
        )}

        {/* Save button */}
        {hasChanges && (
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const LaundryScheduleConfigModal = ({
  open,
  onOpenChange,
}: LaundryScheduleConfigModalProps) => {
  const { schedules, isLoading, updateSchedule } = useLaundryDeliverySchedule();

  const handleUpdate = (id: string, collectionDays: number[], isActive: boolean) => {
    updateSchedule.mutate({ id, collectionDays, isActive });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurar Días de Reparto
          </DialogTitle>
          <DialogDescription>
            Define qué días se realiza el reparto y qué servicios se recogen en cada uno.
            Estos ajustes aplican a la sede actual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : schedules && schedules.length > 0 ? (
            schedules.map(schedule => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                onUpdate={handleUpdate}
                isUpdating={updateSchedule.isPending}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay días de reparto configurados.</p>
              <p className="text-sm">Los días predeterminados (L-X-V-D) se crearán automáticamente.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
