
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ClientPropertySelector } from "./ClientPropertySelector";
import { useCreateRecurringTask } from "@/hooks/useRecurringTasks";
import { RecurringTask } from "@/types/recurring";

interface CreateRecurringTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateRecurringTaskModal = ({ open, onOpenChange }: CreateRecurringTaskModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clienteId: '',
    propiedadId: '',
    type: 'mantenimiento-airbnb',
    startTime: '09:00',
    endTime: '12:00',
    checkOut: '11:00',
    checkIn: '15:00',
    duracion: 180,
    coste: 0,
    metodoPago: 'transferencia',
    supervisor: '',
    cleaner: '',
    frequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
    interval: 1,
    daysOfWeek: [1], // Lunes por defecto
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isActive: true
  });

  const createRecurringTask = useCreateRecurringTask();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const taskData: Omit<RecurringTask, 'id' | 'createdAt' | 'nextExecution'> = {
      ...formData,
      clienteId: formData.clienteId || undefined,
      propiedadId: formData.propiedadId || undefined,
      endDate: formData.endDate || undefined,
      cleaner: formData.cleaner || undefined,
      lastExecution: undefined
    };

    createRecurringTask.mutate(taskData);
    onOpenChange(false);
    
    // Reset form
    setFormData({
      name: '',
      description: '',
      clienteId: '',
      propiedadId: '',
      type: 'mantenimiento-airbnb',
      startTime: '09:00',
      endTime: '12:00',
      checkOut: '11:00',
      checkIn: '15:00',
      duracion: 180,
      coste: 0,
      metodoPago: 'transferencia',
      supervisor: '',
      cleaner: '',
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1],
      dayOfMonth: 1,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      isActive: true
    });
  };

  const serviceTypes = [
    { value: 'limpieza-mantenimiento', label: 'Limpieza de Mantenimiento' },
    { value: 'mantenimiento-cristaleria', label: 'Mantenimiento de Cristalería' },
    { value: 'mantenimiento-airbnb', label: 'Mantenimiento Airbnb' },
    { value: 'limpieza-puesta-punto', label: 'Limpieza de Puesta a Punto' },
    { value: 'limpieza-final-obra', label: 'Limpieza Final de Obra' },
    { value: 'check-in', label: 'Check In' },
    { value: 'desplazamiento', label: 'Desplazamiento' },
    { value: 'limpieza-especial', label: 'Limpieza Especial' },
    { value: 'trabajo-extraordinario', label: 'Trabajo Extraordinario' }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Tarea Recurrente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información Básica */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información Básica</h3>
            
            <div>
              <Label htmlFor="name">Nombre de la Tarea</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Descripción (Opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="type">Tipo de Servicio</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Cliente y Propiedad */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Cliente y Propiedad</h3>
            <ClientPropertySelector
              selectedClientId={formData.clienteId}
              selectedPropertyId={formData.propiedadId}
              onClientChange={(clientId) => setFormData(prev => ({ ...prev, clienteId, propiedadId: '' }))}
              onPropertyChange={(propertyId) => setFormData(prev => ({ ...prev, propiedadId: propertyId }))}
            />
          </div>

          <Separator />

          {/* Configuración de Horarios */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Horarios</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Hora de Inicio</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="endTime">Hora de Fin</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="checkOut">Check-out</Label>
                <Input
                  id="checkOut"
                  type="time"
                  value={formData.checkOut}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkOut: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="checkIn">Check-in</Label>
                <Input
                  id="checkIn"
                  type="time"
                  value={formData.checkIn}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkIn: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Configuración de Recurrencia */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Configuración de Recurrencia</h3>
            
            <div>
              <Label htmlFor="frequency">Frecuencia</Label>
              <Select value={formData.frequency} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setFormData(prev => ({ ...prev, frequency: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diaria</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="interval">Cada</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="interval"
                  type="number"
                  min="1"
                  value={formData.interval}
                  onChange={(e) => setFormData(prev => ({ ...prev, interval: parseInt(e.target.value) || 1 }))}
                  className="w-20"
                />
                <span className="text-sm text-gray-600">
                  {formData.frequency === 'daily' && 'días'}
                  {formData.frequency === 'weekly' && 'semanas'}
                  {formData.frequency === 'monthly' && 'meses'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Fecha de Inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="endDate">Fecha de Fin (Opcional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive">Tarea activa</Label>
            </div>
          </div>

          <Separator />

          {/* Botones */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createRecurringTask.isPending}>
              {createRecurringTask.isPending ? 'Creando...' : 'Crear Tarea Recurrente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
