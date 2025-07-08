
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Task } from "@/types/calendar";
import { useToast } from "@/hooks/use-toast";
import { TaskReportModal } from "./TaskReportModal";
import { TaskDetailsHeader } from "./task-details/TaskDetailsHeader";
import { TaskDetailsForm } from "./task-details/TaskDetailsForm";
import { TaskDetailsActions } from "./task-details/TaskDetailsActions";
import { TaskDetailsConfirmDialogs } from "./task-details/TaskDetailsConfirmDialogs";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
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
    onDeleteTask(task.id);
    onOpenChange(false);
    setShowDeleteConfirm(false);
    toast({
      title: "Tarea eliminada",
      description: "La tarea se ha eliminado correctamente.",
    });
  };

  const handleUnassign = () => {
    if (onUnassignTask && task.cleaner) {
      onUnassignTask(task.id);
      onOpenChange(false);
      setShowUnassignConfirm(false);
      toast({
        title: "Tarea desasignada",
        description: "La tarea se ha enviado a la lista de tareas sin asignar.",
      });
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData(task);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
          <DialogHeader>
            <TaskDetailsHeader task={task} isEditing={isEditing} />
          </DialogHeader>
          
          <TaskDetailsForm
            task={task}
            isEditing={isEditing}
            formData={formData}
            onFieldChange={handleFieldChange}
          />

          <DialogFooter>
            <TaskDetailsActions
              task={task}
              isEditing={isEditing}
              onEdit={() => setIsEditing(true)}
              onSave={handleSave}
              onCancel={handleCancel}
              onDelete={() => setShowDeleteConfirm(true)}
              onUnassign={onUnassignTask ? () => setShowUnassignConfirm(true) : undefined}
              onOpenReport={() => setShowReportModal(true)}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Report Modal */}
      <TaskReportModal
        task={task}
        open={showReportModal}
        onOpenChange={setShowReportModal}
      />

      <TaskDetailsConfirmDialogs
        task={task}
        showDeleteConfirm={showDeleteConfirm}
        onDeleteConfirmChange={setShowDeleteConfirm}
        showUnassignConfirm={showUnassignConfirm}
        onUnassignConfirmChange={setShowUnassignConfirm}
        onConfirmDelete={handleDelete}
        onConfirmUnassign={handleUnassign}
      />
    </>
  );
};
