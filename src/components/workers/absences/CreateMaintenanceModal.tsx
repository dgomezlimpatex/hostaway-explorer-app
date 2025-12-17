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
import { Checkbox } from '@/components/ui/checkbox';
import { DAY_OF_WEEK_LABELS } from '@/types/workerAbsence';
import { useCreateWorkerMaintenanceCleaning } from '@/hooks/useWorkerMaintenanceCleanings';
import { Loader2 } from 'lucide-react';

interface CreateMaintenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cleanerId: string;
  cleanerName: string;
}

export const CreateMaintenanceModal: React.FC<CreateMaintenanceModalProps> = ({
  open,
  onOpenChange,
  cleanerId,
  cleanerName,
}) => {
  const createMutation = useCreateWorkerMaintenanceCleaning();
  
  const [formData, setFormData] = useState({
    locationName: '',
    daysOfWeek: [] as number[],
    startTime: '09:00',
    endTime: '10:00',
    notes: '',
  });

  const handleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.daysOfWeek.length === 0) {
      return;
    }
    
    createMutation.mutate({
      cleanerId,
      locationName: formData.locationName,
      daysOfWeek: formData.daysOfWeek,
      startTime: formData.startTime,
      endTime: formData.endTime,
      notes: formData.notes || null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({
          locationName: '',
          daysOfWeek: [],
          startTime: '09:00',
          endTime: '10:00',
          notes: '',
        });
      },
    });
  };

  // Order days starting from Monday (1) to Sunday (0)
  const orderedDays = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nueva Limpieza de Mantenimiento</DialogTitle>
          <DialogDescription>
            Configurar compromiso de limpieza externo para {cleanerName}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Location name */}
          <div className="space-y-2">
            <Label htmlFor="locationName">Nombre del lugar *</Label>
            <Input
              id="locationName"
              value={formData.locationName}
              onChange={(e) => setFormData(prev => ({ ...prev, locationName: e.target.value }))}
              placeholder="Ej: Farmacia García, Oficina Centro..."
              required
            />
          </div>

          {/* Days of week */}
          <div className="space-y-2">
            <Label>Días de la semana *</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {orderedDays.map(day => (
                <div key={day} className="flex items-center space-x-2">
                  <Checkbox
                    id={`maintenance-day-${day}`}
                    checked={formData.daysOfWeek.includes(day)}
                    onCheckedChange={() => handleDayToggle(day)}
                  />
                  <Label 
                    htmlFor={`maintenance-day-${day}`}
                    className="text-sm cursor-pointer"
                  >
                    {DAY_OF_WEEK_LABELS[day]}
                  </Label>
                </div>
              ))}
            </div>
            {formData.daysOfWeek.length === 0 && (
              <p className="text-xs text-destructive">Selecciona al menos un día</p>
            )}
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Hora inicio *</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Hora fin *</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                required
              />
            </div>
          </div>

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
            <Button 
              type="submit" 
              disabled={createMutation.isPending || formData.daysOfWeek.length === 0 || !formData.locationName}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
