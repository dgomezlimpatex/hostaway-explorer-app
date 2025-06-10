
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
import { Calendar, Clock, Users } from "lucide-react";
import { MultiPropertySelector } from "./batch-create/MultiPropertySelector";
import { BatchTaskForm } from "./batch-create/BatchTaskForm";
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
    generateTasksFromBatch,
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

    const tasks = generateTasksFromBatch();
    onCreateTasks(tasks);
    onOpenChange(false);
    resetBatchForm();
    
    toast({
      title: "Tareas creadas",
      description: `Se han creado ${tasks.length} tareas correctamente.`,
    });
  };

  const handleCancel = () => {
    onOpenChange(false);
    resetBatchForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-700 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Crear Múltiples Tareas
          </DialogTitle>
          <DialogDescription>
            Selecciona múltiples propiedades y configura los datos comunes para crear varias tareas a la vez.
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
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Configuración común para todas las tareas
                </h3>
                <BatchTaskForm
                  batchData={batchData}
                  onFieldChange={updateBatchData}
                />
              </div>

              {/* Resumen */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Resumen
                </h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>Se crearán <Badge variant="secondary">{selectedProperties.length}</Badge> tareas</p>
                  <p>Fecha: <span className="font-medium">{batchData.date}</span></p>
                  <p>Horario: <span className="font-medium">{batchData.startTime} - {batchData.endTime}</span></p>
                  <p>Tipo: <span className="font-medium">{batchData.type}</span></p>
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
              className="bg-blue-600 hover:bg-blue-700"
            >
              Crear {selectedProperties.length} Tareas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
