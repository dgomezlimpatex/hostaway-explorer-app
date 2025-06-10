
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, AlertTriangle } from "lucide-react";
import { Task } from "@/types/calendar";
import { useToast } from "@/hooks/use-toast";
import { useCleaners } from "@/hooks/useCleaners";
import { useTasks } from "@/hooks/useTasks";

interface AssignCleanerModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignCleaner: (taskId: string, cleanerId: string, cleaners: any[]) => void;
}

export const AssignCleanerModal = ({ 
  task, 
  open, 
  onOpenChange, 
  onAssignCleaner 
}: AssignCleanerModalProps) => {
  const [selectedCleaner, setSelectedCleaner] = useState('');
  const { toast } = useToast();
  const { cleaners, isLoading: isLoadingCleaners } = useCleaners();
  const { tasks } = useTasks(task ? new Date(task.date) : new Date(), 'day');

  if (!task) return null;

  // Check for time conflicts
  const checkTimeConflicts = (cleanerId: string) => {
    const cleaner = cleaners.find(c => c.id === cleanerId);
    if (!cleaner) return [];

    const taskStart = new Date(`${task.date}T${task.startTime}`);
    const taskEnd = new Date(`${task.date}T${task.endTime}`);

    return tasks.filter(t => 
      t.id !== task.id &&
      t.cleaner === cleaner.name &&
      t.date === task.date
    ).filter(t => {
      const existingStart = new Date(`${t.date}T${t.startTime}`);
      const existingEnd = new Date(`${t.date}T${t.endTime}`);
      
      return (taskStart < existingEnd && taskEnd > existingStart);
    });
  };

  const conflicts = selectedCleaner ? checkTimeConflicts(selectedCleaner) : [];

  const handleAssign = () => {
    if (!selectedCleaner) {
      toast({
        title: "Error",
        description: "Por favor selecciona un limpiador.",
        variant: "destructive",
      });
      return;
    }

    if (conflicts.length > 0) {
      toast({
        title: "Conflicto de horarios",
        description: "El limpiador seleccionado tiene tareas conflictivas en ese horario.",
        variant: "destructive",
      });
      return;
    }

    onAssignCleaner(task.id, selectedCleaner, cleaners);
    onOpenChange(false);
    setSelectedCleaner('');
    toast({
      title: "Limpiador asignado",
      description: "La tarea se ha asignado correctamente.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Asignar Limpiador</DialogTitle>
          <DialogDescription>
            Selecciona un limpiador para la tarea: {task.property}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <User className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-600">Actualmente asignado a:</span>
            <Badge variant="outline">
              {task.cleaner || 'Sin asignar'}
            </Badge>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nuevo limpiador:</label>
            <Select value={selectedCleaner} onValueChange={setSelectedCleaner} disabled={isLoadingCleaners}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar limpiador" />
              </SelectTrigger>
              <SelectContent>
                {cleaners.map((cleaner) => (
                  <SelectItem 
                    key={cleaner.id} 
                    value={cleaner.id}
                    disabled={!cleaner.isActive}
                  >
                    <div className="flex items-center gap-2">
                      <span>{cleaner.name}</span>
                      {!cleaner.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {conflicts.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Conflicto de horarios detectado. El limpiador tiene {conflicts.length} tarea(s) en el mismo período:
                <ul className="mt-2 space-y-1">
                  {conflicts.map(conflict => (
                    <li key={conflict.id} className="text-xs">
                      • {conflict.property} ({conflict.startTime} - {conflict.endTime})
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAssign} disabled={conflicts.length > 0}>
            Asignar Limpiador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
