import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/types/calendar";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, User } from "lucide-react";
import { MultiPropertySelector } from "./batch-create/MultiPropertySelector";
import { BatchTaskForm } from "./batch-create/BatchTaskForm";
import { BatchCleanerAssignment } from "./batch-create/BatchCleanerAssignment";
import { useBatchCreateTask } from "./batch-create/useBatchCreateTask";

interface BatchCreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTasks: (tasks: Omit<Task, 'id'>[]) => void;
}

export const BatchCreateTaskModal = ({ 
  open, 
  onOpenChange, 
  onCreateTasks 
}: BatchCreateTaskModalProps) => {
  const { toast } = useToast();
  
  const {
    selectedProperties,
    setSelectedProperties,
    selectedClientId,
    setSelectedClientId,
    batchData,
    updateBatchData,
    assignmentConfig,
    setAssignmentConfig,
    generateTasksFromBatch,
    getSchedulePreview,
    resetBatchForm
  } = useBatchCreateTask();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedProperties.length === 0) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos una propiedad.",
        variant: "destructive",
      });
      return;
    }

    if (!batchData.startTime || !batchData.date) {
      toast({
        title: "Error",
        description: "Fecha y hora de inicio son obligatorias.",
        variant: "destructive",
      });
      return;
    }

    // Validate assignment config
    if (assignmentConfig.mode === 'single' && !assignmentConfig.selectedCleanerId) {
      toast({
        title: "Error",
        description: "Debes seleccionar un cleaner para asignar las tareas.",
        variant: "destructive",
      });
      return;
    }

    if (assignmentConfig.mode === 'distributed' && assignmentConfig.selectedCleanerIds.length === 0) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos un cleaner para distribuir las tareas.",
        variant: "destructive",
      });
      return;
    }

    const tasks = generateTasksFromBatch();
    onCreateTasks(tasks);
    onOpenChange(false);
    resetBatchForm();
    
    const assignmentMessage = assignmentConfig.mode === 'none' 
      ? 'sin asignar'
      : assignmentConfig.mode === 'single'
        ? 'asignadas a un cleaner'
        : `distribuidas entre ${assignmentConfig.selectedCleanerIds.length} cleaners`;
    
    toast({
      title: "Tareas creadas",
      description: `Se han creado ${tasks.length} tareas ${assignmentMessage}.`,
    });
  };

  const handleCancel = () => {
    onOpenChange(false);
    resetBatchForm();
  };

  const schedulePreview = getSchedulePreview();

  const getAssignmentLabel = () => {
    if (assignmentConfig.mode === 'none') return 'Sin asignar';
    if (assignmentConfig.mode === 'single') return 'Asignar a un cleaner';
    return `Distribuir entre ${assignmentConfig.selectedCleanerIds.length} cleaners`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
            <Users className="h-5 w-5" />
            Crear Múltiples Tareas
          </DialogTitle>
          <DialogDescription>
            Selecciona propiedades, configura datos comunes y asigna cleaners para crear varias tareas a la vez.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selector de Propiedades Múltiples */}
          <MultiPropertySelector
            selectedProperties={selectedProperties}
            onPropertiesChange={setSelectedProperties}
            onClientChange={setSelectedClientId}
          />

          {/* Configuración Común de Tareas */}
          {selectedProperties.length > 0 && (
            <>
              <div className="border-t pt-4">
                <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Configuración común para todas las tareas
                </h3>
                <BatchTaskForm
                  batchData={batchData}
                  onFieldChange={updateBatchData}
                />
              </div>

              {/* Asignación de Cleaners */}
              <div className="border-t pt-4">
                <BatchCleanerAssignment
                  config={assignmentConfig}
                  onConfigChange={setAssignmentConfig}
                  taskCount={selectedProperties.length}
                />
              </div>

              {/* Resumen Mejorado */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-medium text-primary mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Resumen
                </h4>
                <div className="text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Tareas a crear:</span>
                    <Badge variant="secondary">{selectedProperties.length}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Fecha:</span>
                    <span className="font-medium">{batchData.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-medium">{batchData.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Asignación:</span>
                    <Badge variant={assignmentConfig.mode === 'none' ? 'outline' : 'default'}>
                      {getAssignmentLabel()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Horarios:</span>
                    <span className="font-medium">
                      {assignmentConfig.autoScale ? 'Escalonados automáticamente' : 'Mismo horario'}
                    </span>
                  </div>

                  {/* Vista previa de distribución */}
                  {schedulePreview.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-primary/10">
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Vista previa de horarios:
                      </p>
                      <div className="space-y-1">
                        {schedulePreview.map((item, idx) => (
                          <div key={idx} className="text-xs flex justify-between bg-background/50 p-2 rounded">
                            <span className="font-medium">{item.cleanerName}</span>
                            <span className="text-muted-foreground">
                              {item.taskCount} tareas ({item.startTime} - {item.endTime})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={selectedProperties.length === 0}
            >
              Crear {selectedProperties.length} Tareas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
