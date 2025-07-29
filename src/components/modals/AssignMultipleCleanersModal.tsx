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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, AlertTriangle, Users } from "lucide-react";
import { Task } from "@/types/calendar";
import { TaskAssignment } from "@/types/taskAssignments";
import { useToast } from "@/hooks/use-toast";
import { useCleaners } from "@/hooks/useCleaners";
import { multipleTaskAssignmentService } from "@/services/storage/multipleTaskAssignmentService";

interface AssignMultipleCleanersModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignComplete: () => void;
}

export const AssignMultipleCleanersModal = ({ 
  task, 
  open, 
  onOpenChange, 
  onAssignComplete 
}: AssignMultipleCleanersModalProps) => {
  const [selectedCleaners, setSelectedCleaners] = useState<string[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<TaskAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { cleaners, isLoading: isLoadingCleaners } = useCleaners();

  useEffect(() => {
    if (task && open) {
      loadCurrentAssignments();
    }
  }, [task, open]);

  const loadCurrentAssignments = async () => {
    if (!task) return;
    
    try {
      const assignments = await multipleTaskAssignmentService.getTaskAssignments(task.originalTaskId || task.id);
      setCurrentAssignments(assignments);
      setSelectedCleaners(assignments.map(a => a.cleaner_id));
    } catch (error) {
      console.error('Error loading current assignments:', error);
    }
  };

  const handleCleanerToggle = (cleanerId: string) => {
    setSelectedCleaners(prev => {
      if (prev.includes(cleanerId)) {
        return prev.filter(id => id !== cleanerId);
      } else {
        return [...prev, cleanerId];
      }
    });
  };

  const handleAssign = async () => {
    if (!task) return;

    if (selectedCleaners.length === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos una limpiadora.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await multipleTaskAssignmentService.assignMultipleCleaners(task.originalTaskId || task.id, selectedCleaners);
      
      toast({
        title: "Limpiadoras asignadas",
        description: `Se han asignado ${selectedCleaners.length} limpiadora(s) a la tarea.`,
      });
      
      onAssignComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error assigning cleaners:', error);
      toast({
        title: "Error",
        description: "No se pudo completar la asignación.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAssignments = async () => {
    if (!task) return;

    setIsLoading(true);
    try {
      await multipleTaskAssignmentService.clearTaskAssignments(task.originalTaskId || task.id);
      setSelectedCleaners([]);
      setCurrentAssignments([]);
      
      toast({
        title: "Asignaciones eliminadas",
        description: "Se han eliminado todas las asignaciones de la tarea.",
      });
      
      onAssignComplete();
    } catch (error) {
      console.error('Error clearing assignments:', error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar las asignaciones.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!task) return null;

  const activeCleaners = cleaners.filter(cleaner => cleaner.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Asignar Múltiples Limpiadoras
          </DialogTitle>
          <DialogDescription>
            Selecciona las limpiadoras para la tarea: {task.property}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Current assignments */}
          {currentAssignments.length > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  Actualmente asignado a:
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentAssignments.map((assignment) => (
                  <Badge key={assignment.id} variant="outline" className="bg-blue-100">
                    {assignment.cleaner_name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Cleaner selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Seleccionar limpiadoras:</label>
            
            {isLoadingCleaners ? (
              <div className="text-center py-4 text-gray-500">
                Cargando limpiadoras...
              </div>
            ) : activeCleaners.length === 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No hay limpiadoras activas disponibles.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {activeCleaners.map((cleaner) => {
                  const isSelected = selectedCleaners.includes(cleaner.id);
                  return (
                    <div
                      key={cleaner.id}
                      className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-blue-300 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleCleanerToggle(cleaner.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleCleanerToggle(cleaner.id)}
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">{cleaner.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selection summary */}
          {selectedCleaners.length > 0 && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  {selectedCleaners.length} limpiadora(s) seleccionada(s)
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          
          {currentAssignments.length > 0 && (
            <Button 
              variant="destructive" 
              onClick={handleClearAssignments} 
              disabled={isLoading}
            >
              Limpiar Asignaciones
            </Button>
          )}
          
          <Button 
            onClick={handleAssign} 
            disabled={isLoading || selectedCleaners.length === 0}
          >
            {isLoading ? 'Asignando...' : 'Asignar Limpiadoras'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};