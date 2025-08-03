
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
import { CleanerSection } from "./create-task/CleanerSection";
import { NotesTextArea } from "./create-task/NotesSection";
import { useCreateTaskForm } from "./create-task/useCreateTaskForm";

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: (taskData: Omit<Task, 'id'>) => Promise<void>;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClient || !selectedProperty) {
      toast({
        title: "Error",
        description: "Por favor selecciona cliente y propiedad.",
        variant: "destructive",
      });
      return;
    }

    // Si no hay hora de inicio, usar check-out como predeterminada
    const finalStartTime = formData.startTime || formData.checkOut;
    const finalEndTime = formData.endTime || (finalStartTime && formData.duracion > 0 ? 
      (() => {
        const [hours, minutes] = finalStartTime.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + formData.duracion;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
      })() : '');

    const taskData: Omit<Task, 'id'> = {
      ...formData,
      startTime: finalStartTime,
      endTime: finalEndTime,
      cleaner: formData.cleaner === 'unassigned' ? '' : formData.cleaner,
      cleanerId: formData.cleaner === 'unassigned' ? undefined : formData.cleanerId,
      clienteId: selectedClient.id,
      propertyId: selectedProperty.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('🔵 CreateTaskModal - handleSubmit called with:', taskData);
    
    try {
      await onCreateTask(taskData);
      console.log('✅ CreateTaskModal - onCreateTask completed successfully');
      onOpenChange(false);
      resetForm();
      // Don't show toast here - it's handled in useCalendarLogic
    } catch (error) {
      console.error('❌ CreateTaskModal - onCreateTask error:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la tarea.",
        variant: "destructive",
      });
    }
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

          <CleanerSection
            formData={formData}
            onFieldChange={handleChange}
          />

          <NotesTextArea
            notes={formData.notes || ''}
            onNotesChange={(notes) => handleChange('notes', notes)}
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
