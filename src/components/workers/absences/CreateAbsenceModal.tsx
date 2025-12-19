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
}

export const CreateAbsenceModal: React.FC<CreateAbsenceModalProps> = ({
  open,
  onOpenChange,
  cleanerId,
  cleanerName,
  initialDate,
}) => {
  const createMutation = useCreateWorkerAbsence();
  
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

  const [formData, setFormData] = useState({
    absenceType: 'vacation' as AbsenceType,
    startDate: defaultDate,
    endDate: defaultDate,
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
      setFormData(prev => ({
        ...prev,
        startDate: newDate,
        endDate: newDate,
      }));
    }
  }, [open, initialDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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
          endDate: defaultDate,
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nueva Ausencia</DialogTitle>
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
                {Object.entries(ABSENCE_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.icon} {config.label}
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
                placeholder="Ej: Cita médica, Gestión personal..."
              />
            </div>
          )}

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
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
          <div className="flex items-center justify-between py-2">
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
            <div className="grid grid-cols-2 gap-4">
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
                />
              </div>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Ausencia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
