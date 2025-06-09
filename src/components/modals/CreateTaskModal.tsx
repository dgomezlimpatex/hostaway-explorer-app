
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Task } from "@/hooks/useCalendarData";

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: (task: Omit<Task, 'id'>) => void;
}

export const CreateTaskModal = ({ open, onOpenChange, onCreateTask }: CreateTaskModalProps) => {
  const [formData, setFormData] = useState({
    property: '',
    address: '',
    startTime: '',
    endTime: '',
    type: 'checkout-checkin',
    status: 'pending' as const,
    checkOut: '',
    checkIn: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.property || !formData.startTime || !formData.endTime) {
      return;
    }

    onCreateTask(formData);
    
    // Reset form
    setFormData({
      property: '',
      address: '',
      startTime: '',
      endTime: '',
      type: 'checkout-checkin',
      status: 'pending',
      checkOut: '',
      checkIn: '',
    });
    
    onOpenChange(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nueva Tarea</DialogTitle>
          <DialogDescription>
            Completa los detalles para crear una nueva tarea de limpieza.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="property">Propiedad *</Label>
              <Input
                id="property"
                value={formData.property}
                onChange={(e) => handleChange('property', e.target.value)}
                placeholder="Nombre de la propiedad"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Dirección completa"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Hora Inicio *</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => handleChange('startTime', e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endTime">Hora Fin *</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => handleChange('endTime', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkOut">Check-out</Label>
              <Input
                id="checkOut"
                type="time"
                value={formData.checkOut}
                onChange={(e) => handleChange('checkOut', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="checkIn">Check-in</Label>
              <Input
                id="checkIn"
                type="time"
                value={formData.checkIn}
                onChange={(e) => handleChange('checkIn', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={formData.type} onValueChange={(value) => handleChange('type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checkout-checkin">Check-out/Check-in</SelectItem>
                  <SelectItem value="maintenance">Mantenimiento</SelectItem>
                  <SelectItem value="deep-cleaning">Limpieza Profunda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={formData.status} onValueChange={(value) => handleChange('status', value as Task['status'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in-progress">En Progreso</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Crear Tarea
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
