
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ClientPropertySelector } from "./ClientPropertySelector";
import { useCreateRecurringTask } from "@/hooks/useRecurringTasks";
import { useRecurringTaskForm } from "./recurring-task/useRecurringTaskForm";
import { BasicInfoSection } from "./recurring-task/BasicInfoSection";
import { ScheduleSection } from "./recurring-task/ScheduleSection";
import { RecurrenceSection } from "./recurring-task/RecurrenceSection";

interface CreateRecurringTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateRecurringTaskModal = ({ open, onOpenChange }: CreateRecurringTaskModalProps) => {
  const createRecurringTask = useCreateRecurringTask();
  const {
    formData,
    updateFormData,
    handleClientChange,
    handlePropertyChange,
    resetForm,
    getTaskData
  } = useRecurringTaskForm();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const taskData = getTaskData();
    createRecurringTask.mutate(taskData);
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Tarea Recurrente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <BasicInfoSection formData={formData} updateFormData={updateFormData} />

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Cliente y Propiedad</h3>
            <ClientPropertySelector
              selectedClientId={formData.clienteId}
              selectedPropertyId={formData.propiedadId}
              onClientChange={handleClientChange}
              onPropertyChange={handlePropertyChange}
            />
          </div>

          <Separator />

          <ScheduleSection formData={formData} updateFormData={updateFormData} />

          <Separator />

          <RecurrenceSection formData={formData} updateFormData={updateFormData} />

          <Separator />

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
