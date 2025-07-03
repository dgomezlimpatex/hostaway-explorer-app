
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
import { ClientPropertySelector } from "./ClientPropertySelector";
import { TimeFieldsSection } from "./create-task/TimeFieldsSection";
import { CostPaymentSection } from "./create-task/CostPaymentSection";
import { CheckInOutSection } from "./create-task/CheckInOutSection";
import { TypeStatusSection } from "./create-task/TypeStatusSection";
import { useCreateTaskForm } from "./create-task/useCreateTaskForm";

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
  const { toast } = useToast();
  
  const {
    selectedClient,
    setSelectedClient,
    selectedProperty,
    setSelectedProperty,
    formData,
    handleChange,
    convertMinutesToTime,
    resetForm
  } = useCreateTaskForm(currentDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClient || !selectedProperty) {
      toast({
        title: "Error",
        description: "Por favor selecciona cliente y propiedad.",
        variant: "destructive",
      });
      return;
    }

    const taskData: Omit<Task, 'id'> = {
      ...formData,
      clienteId: selectedClient.id,
      propertyId: selectedProperty.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    onCreateTask(taskData);
    onOpenChange(false);
    resetForm();
    
    toast({
      title: "Tarea creada",
      description: "La nueva tarea se ha creado correctamente.",
    });
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

          <TimeFieldsSection
            formData={formData}
            onFieldChange={handleChange}
            convertMinutesToTime={convertMinutesToTime}
          />

          <CostPaymentSection formData={formData} />

          <CheckInOutSection formData={formData} />

          <TypeStatusSection
            formData={formData}
            onFieldChange={handleChange}
          />

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
