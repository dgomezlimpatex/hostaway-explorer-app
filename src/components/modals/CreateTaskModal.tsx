
import { useState, useEffect } from 'react';
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
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/types/calendar";
import { Client } from "@/types/client";
import { Property } from "@/types/property";
import { ClientPropertySelector } from "./ClientPropertySelector";

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: (taskData: Omit<Task, 'id'>) => void;
  currentDate?: Date;
}

export const CreateTaskModal = ({ 
  open, 
  onOpenChange, 
  onCreateTask,
  currentDate = new Date()
}: CreateTaskModalProps) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  
  const [formData, setFormData] = useState({
    property: '',
    address: '',
    startTime: '',
    endTime: '',
    type: 'checkout-checkin',
    status: 'pending' as const,
    checkOut: '',
    checkIn: '',
    cleaner: '',
    date: currentDate.toISOString().split('T')[0],
    duracion: 0,
    coste: 0,
    metodoPago: '',
    supervisor: ''
  });
  
  const { toast } = useToast();

  // Función para convertir minutos a formato HH:MM
  const convertMinutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Autocompletar campos cuando se selecciona una propiedad
  useEffect(() => {
    if (selectedProperty && selectedClient) {
      setFormData(prev => ({
        ...prev,
        property: `${selectedProperty.codigo} - ${selectedProperty.nombre}`,
        address: selectedProperty.direccion,
        duracion: selectedProperty.duracionServicio,
        coste: selectedProperty.costeServicio,
        metodoPago: selectedClient.metodoPago,
        supervisor: selectedClient.supervisor,
        checkOut: selectedProperty.checkOutPredeterminado || '',
        checkIn: selectedProperty.checkInPredeterminado || ''
      }));
    }
  }, [selectedProperty, selectedClient]);

  // Recalcular hora de fin cuando cambia la hora de inicio o la duración
  useEffect(() => {
    if (formData.startTime && formData.duracion > 0) {
      const [hours, minutes] = formData.startTime.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + formData.duracion;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      setFormData(prev => ({
        ...prev,
        endTime: `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
      }));
    }
  }, [formData.startTime, formData.duracion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClient || !selectedProperty || !formData.startTime) {
      toast({
        title: "Error",
        description: "Por favor selecciona cliente, propiedad y hora de inicio.",
        variant: "destructive",
      });
      return;
    }

    const taskData = {
      ...formData,
      clienteId: selectedClient.id,
      propiedadId: selectedProperty.id
    };

    onCreateTask(taskData);
    onOpenChange(false);
    
    // Reset form
    setSelectedClient(null);
    setSelectedProperty(null);
    setFormData({
      property: '',
      address: '',
      startTime: '',
      endTime: '',
      type: 'checkout-checkin',
      status: 'pending',
      checkOut: '',
      checkIn: '',
      cleaner: '',
      date: currentDate.toISOString().split('T')[0],
      duracion: 0,
      coste: 0,
      metodoPago: '',
      supervisor: ''
    });
    
    toast({
      title: "Tarea creada",
      description: "La nueva tarea se ha creado correctamente.",
    });
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nueva Tarea</DialogTitle>
          <DialogDescription>
            Selecciona el cliente y propiedad para autocompletar los detalles.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <ClientPropertySelector
            onClientChange={setSelectedClient}
            onPropertyChange={setSelectedProperty}
          />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
              />
            </div>
            
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
              <Label htmlFor="endTime">Hora Fin (auto)</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                readOnly
                className="bg-gray-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duracion">Duración</Label>
              <Input
                id="duracion"
                value={convertMinutesToTime(formData.duracion)}
                readOnly
                className="bg-gray-50"
                placeholder="00:00"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="coste">Coste (€)</Label>
              <Input
                id="coste"
                type="number"
                step="0.01"
                value={formData.coste}
                readOnly
                className="bg-gray-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="metodoPago">Método de Pago</Label>
              <Input
                id="metodoPago"
                value={formData.metodoPago}
                readOnly
                className="bg-gray-50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supervisor">Supervisor</Label>
              <Input
                id="supervisor"
                value={formData.supervisor}
                readOnly
                className="bg-gray-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkOut">Check-out (auto)</Label>
              <Input
                id="checkOut"
                type="time"
                value={formData.checkOut}
                readOnly
                className="bg-gray-50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="checkIn">Check-in (auto)</Label>
              <Input
                id="checkIn"
                type="time"
                value={formData.checkIn}
                readOnly
                className="bg-gray-50"
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
                  <SelectItem value="cristaleria">Cristalería</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
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
