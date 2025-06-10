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
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit3, Save, X, UserX } from "lucide-react";
import { Task } from "@/hooks/useCalendarData";
import { useToast } from "@/hooks/use-toast";

interface TaskDetailsModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onUnassignTask?: (taskId: string) => void;
}

export const TaskDetailsModal = ({ 
  task, 
  open, 
  onOpenChange, 
  onUpdateTask, 
  onDeleteTask,
  onUnassignTask 
}: TaskDetailsModalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Task>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (task) {
      setFormData(task);
      setIsEditing(false);
    }
  }, [task]);

  if (!task) return null;

  const handleSave = () => {
    if (!formData.property || !formData.startTime || !formData.endTime) {
      toast({
        title: "Error",
        description: "Por favor completa los campos obligatorios.",
        variant: "destructive",
      });
      return;
    }

    onUpdateTask(task.id, formData);
    setIsEditing(false);
    toast({
      title: "Tarea actualizada",
      description: "Los cambios se han guardado correctamente.",
    });
  };

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
      onDeleteTask(task.id);
      onOpenChange(false);
      toast({
        title: "Tarea eliminada",
        description: "La tarea se ha eliminado correctamente.",
      });
    }
  };

  const handleUnassign = () => {
    if (onUnassignTask && task.cleaner) {
      if (window.confirm('¿Estás seguro de que quieres desasignar esta tarea?')) {
        onUnassignTask(task.id);
        onOpenChange(false);
        toast({
          title: "Tarea desasignada",
          description: "La tarea se ha enviado a la lista de tareas sin asignar.",
        });
      }
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'destructive',
      'in-progress': 'default',
      completed: 'secondary'
    } as const;
    
    const texts = {
      pending: 'Pendiente',
      'in-progress': 'En Progreso',
      completed: 'Completado'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {texts[status as keyof typeof texts] || status}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Detalles de la Tarea</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Edita los detalles de la tarea' : 'Información completa de la tarea'}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing && getStatusBadge(task.status)}
              {task.cleaner && (
                <Badge variant="outline">
                  👤 {task.cleaner}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="property">Propiedad</Label>
              {isEditing ? (
                <Input
                  id="property"
                  value={formData.property || ''}
                  onChange={(e) => handleChange('property', e.target.value)}
                />
              ) : (
                <p className="text-sm p-2 bg-gray-50 rounded">{task.property}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              {isEditing ? (
                <Input
                  id="address"
                  value={formData.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                />
              ) : (
                <p className="text-sm p-2 bg-gray-50 rounded">{task.address}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Hora Inicio</Label>
              {isEditing ? (
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime || ''}
                  onChange={(e) => handleChange('startTime', e.target.value)}
                />
              ) : (
                <p className="text-sm p-2 bg-gray-50 rounded">{task.startTime}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endTime">Hora Fin</Label>
              {isEditing ? (
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime || ''}
                  onChange={(e) => handleChange('endTime', e.target.value)}
                />
              ) : (
                <p className="text-sm p-2 bg-gray-50 rounded">{task.endTime}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkOut">Check-out</Label>
              {isEditing ? (
                <Input
                  id="checkOut"
                  type="time"
                  value={formData.checkOut || ''}
                  onChange={(e) => handleChange('checkOut', e.target.value)}
                />
              ) : (
                <p className="text-sm p-2 bg-gray-50 rounded">{task.checkOut}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="checkIn">Check-in</Label>
              {isEditing ? (
                <Input
                  id="checkIn"
                  type="time"
                  value={formData.checkIn || ''}
                  onChange={(e) => handleChange('checkIn', e.target.value)}
                />
              ) : (
                <p className="text-sm p-2 bg-gray-50 rounded">{task.checkIn}</p>
              )}
            </div>
          </div>

          {isEditing && (
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
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
              
              {task.cleaner && onUnassignTask && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnassign}
                  className="flex items-center gap-2"
                >
                  <UserX className="h-4 w-4" />
                  Desasignar
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setFormData(task);
                    }}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSave}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Guardar
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  Editar
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
