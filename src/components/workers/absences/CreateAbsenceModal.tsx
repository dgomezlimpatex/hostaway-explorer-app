import React, { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AbsenceType, ABSENCE_TYPE_CONFIG } from '@/types/workerAbsence';
import { useCreateWorkerAbsence } from '@/hooks/useWorkerAbsences';
import { Loader2 } from 'lucide-react';

interface CreateAbsenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cleanerId: string;
  cleanerName: string;
  initialDate?: Date | null;
  initialEndDate?: Date | null;
  /** Tipos que se pueden registrar (por defecto, todos). */
  allowedTypes?: AbsenceType[];
}

export const CreateAbsenceModal: React.FC<CreateAbsenceModalProps> = ({
  open,
  onOpenChange,
  cleanerId,
  cleanerName,
  initialDate,
  initialEndDate,
  allowedTypes,
}) => {
  const createMutation = useCreateWorkerAbsence();
  const typeOptions = Object.entries(ABSENCE_TYPE_CONFIG).filter(([key]) => !allowedTypes || allowedTypes.includes(key as AbsenceType));
  
  // Helper to format date as YYYY-MM-DD without timezone conversion
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const defaultDate = initialDate 
    ? formatDateLocal(initialDate) 
    : formatDateLocal(new Date());
  const defaultEndDate = initialEndDate
    ? formatDateLocal(initialEndDate)
    : defaultDate;

  const [formData, setFormData] = useState({
    absenceType: 'vacation' as AbsenceType,
    startDate: defaultDate,
    endDate: defaultEndDate,
    isHourly: false,
    startTime: '09:00',
    endTime: '10:00',
    locationName: '',
    notes: '',
  });

  // Reset form when modal opens with new date
  React.useEffect(() => {
    if (open) {
      const newDate = initialDate 
        ? formatDateLocal(initialDate) 
        : formatDateLocal(new Date());
      const newEndDate = initialEndDate
        ? formatDateLocal(initialEndDate)
        : newDate;
      setFormData(prev => ({
        ...prev,
        startDate: newDate,
        endDate: newEndDate,
      }));
    }
  }, [open, initialDate, initialEndDate]);

  const hourlyRangeInvalid = formData.isHourly && formData.endTime <= formData.startTime;
  const typeNotAllowed = !!allowedTypes && !allowedTypes.includes(formData.absenceType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hourlyRangeInvalid || typeNotAllowed) return;
    
    createMutation.mutate({
      cleanerId,
      startDate: formData.startDate,
      endDate: formData.endDate,
      startTime: formData.isHourly ? formData.startTime : null,
      endTime: formData.isHourly ? formData.endTime : null,
      absenceType: formData.absenceType,
      locationName: formData.absenceType === 'external_work' ? formData.locationName : null,
      notes: formData.notes || null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({
          absenceType: 'vacation',
          startDate: defaultDate,
          endDate: defaultEndDate,
          isHourly: false,
          startTime: '09:00',
          endTime: '10:00',
          locationName: '',
          notes: '',
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Nueva ausencia</DialogTitle>
          <DialogDescription>
            Registrar ausencia para {cleanerName}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Absence Type */}
          <div className="space-y-2">
            <Label htmlFor="absenceType">Tipo de ausencia</Label>
            <Select
              value={formData.absenceType}
              onValueChange={(value: AbsenceType) => 
                setFormData(prev => ({ ...prev, absenceType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location name for external work */}
          {formData.absenceType === 'external_work' && (
            <div className="space-y-2">
              <Label htmlFor="locationName">Nombre del lugar</Label>
              <Input
                id="locationName"
                value={formData.locationName}
                onChange={(e) => setFormData(prev => ({ ...prev, locationName: e.target.value }))}
                placeholder="Ej.: otra empresa o centro de trabajo"
              />
              <p className="text-xs text-muted-foreground">
                Como ausencia bloquea estas fechas concretas. Si es un horario fijo cada semana, regístralo como franja no disponible.
              </p>
            </div>
          )}

          {/* Date range */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  startDate: e.target.value,
                  endDate: e.target.value > prev.endDate ? e.target.value : prev.endDate 
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha fin</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                min={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Hourly toggle */}
          <div className="flex items-center justify-between rounded-2xl border bg-slate-50 p-4">
            <div>
              <Label htmlFor="isHourly">Ausencia por horas</Label>
              <p className="text-xs text-muted-foreground">
                Marca si solo es parte del día
              </p>
            </div>
            <Switch
              id="isHourly"
              checked={formData.isHourly}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, isHourly: checked }))
              }
            />
          </div>

          {/* Time range if hourly */}
          {formData.isHourly && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startTime">Hora inicio</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Hora fin</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  aria-invalid={hourlyRangeInvalid || undefined}
                />
              </div>
              {hourlyRangeInvalid && (
                <p className="text-sm text-destructive sm:col-span-2" role="alert">
                  La hora de fin debe ser posterior a la de inicio.
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Información adicional..."
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending || hourlyRangeInvalid || typeNotAllowed} className="sm:w-auto">
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear ausencia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
