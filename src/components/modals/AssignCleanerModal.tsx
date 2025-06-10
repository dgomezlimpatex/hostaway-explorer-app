
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
import { User } from "lucide-react";
import { Task } from "@/types/calendar";
import { useToast } from "@/hooks/use-toast";

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

  // Mock cleaners data - en un caso real vendría de un hook useCleaners
  const cleaners = [
    { id: '1', name: 'María García', available: true },
    { id: '2', name: 'Ana López', available: true },
    { id: '3', name: 'Carlos Ruiz', available: false },
    { id: '4', name: 'Laura Martín', available: true },
    { id: '5', name: 'Thalia Martínez', available: true }
  ];

  if (!task) return null;

  const handleAssign = () => {
    if (!selectedCleaner) {
      toast({
        title: "Error",
        description: "Por favor selecciona un limpiador.",
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
            <Select value={selectedCleaner} onValueChange={setSelectedCleaner}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar limpiador" />
              </SelectTrigger>
              <SelectContent>
                {cleaners.map((cleaner) => (
                  <SelectItem 
                    key={cleaner.id} 
                    value={cleaner.id}
                    disabled={!cleaner.available}
                  >
                    <div className="flex items-center gap-2">
                      <span>{cleaner.name}</span>
                      {!cleaner.available && (
                        <Badge variant="secondary" className="text-xs">
                          No disponible
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAssign}>
            Asignar Limpiador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
