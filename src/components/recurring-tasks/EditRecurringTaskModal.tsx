import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ClientPropertySelector } from "../modals/ClientPropertySelector";
import { useUpdateRecurringTask } from "@/hooks/useRecurringTasks";
import { useRecurringTaskForm } from "../modals/recurring-task/useRecurringTaskForm";
import { BasicInfoSection } from "../modals/recurring-task/BasicInfoSection";
import { ScheduleSection } from "../modals/recurring-task/ScheduleSection";
import { RecurrenceSection } from "../modals/recurring-task/RecurrenceSection";
import { RecurringTask } from '@/types/recurring';
import { toast } from '@/hooks/use-toast';

interface EditRecurringTaskModalProps {
  task: RecurringTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditRecurringTaskModal = ({ task, open, onOpenChange }: EditRecurringTaskModalProps) => {
  const updateRecurringTask = useUpdateRecurringTask();
  
  const {
    formData,
    updateFormData,
    handleClientChange,
    handlePropertyChange,
    resetForm,
    getTaskData
  } = useRecurringTaskForm();

  // Initialize form with existing task data
  React.useEffect(() => {
    if (task && open) {
      updateFormData('name', task.name);
      updateFormData('description', task.description || '');
      updateFormData('clienteId', task.clienteId || '');
      updateFormData('propiedadId', task.propiedadId || '');
      updateFormData('type', task.type);
      updateFormData('startTime', task.startTime);
      updateFormData('endTime', task.endTime);
      updateFormData('checkOut', task.checkOut);
      updateFormData('checkIn', task.checkIn);
      updateFormData('duracion', task.duracion || 180);
      updateFormData('coste', task.coste || 0);
      updateFormData('metodoPago', task.metodoPago || 'transferencia');
      updateFormData('supervisor', task.supervisor || '');
      updateFormData('cleaner', task.cleaner || '');
      updateFormData('frequency', task.frequency);
      updateFormData('interval', task.interval);
      updateFormData('daysOfWeek', task.daysOfWeek || [1]);
      updateFormData('dayOfMonth', task.dayOfMonth || 1);
      updateFormData('startDate', task.startDate);
      updateFormData('endDate', task.endDate || '');
      updateFormData('isActive', task.isActive);
    }
  }, [task, open, updateFormData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const taskData = getTaskData();
      
      await updateRecurringTask.mutateAsync({
        id: task.id,
        updates: taskData
      });
      
      onOpenChange(false);
      resetForm();
      
      toast({
        title: "Tarea actualizada",
        description: "La tarea recurrente ha sido actualizada exitosamente.",
      });
    } catch (error) {
      console.error('Error updating recurring task:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al actualizar la tarea recurrente.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Tarea Recurrente</DialogTitle>
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
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateRecurringTask.isPending}>
              {updateRecurringTask.isPending ? 'Actualizando...' : 'Actualizar Tarea'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};