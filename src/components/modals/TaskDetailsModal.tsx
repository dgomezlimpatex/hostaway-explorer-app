import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Task } from "@/types/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { TaskReportModal } from "./TaskReportModal";
import { TaskDetailsHeader } from "./task-details/TaskDetailsHeader";
import { TaskDetailsForm } from "./task-details/TaskDetailsForm";
import { TaskDetailsActions } from "./task-details/TaskDetailsActions";
import { TaskDetailsConfirmDialogs } from "./task-details/TaskDetailsConfirmDialogs";
import { taskAssignmentService } from "@/services/storage/taskAssignmentService";
interface TaskDetailsModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onUnassignTask?: (taskId: string) => void;
  openInEditMode?: boolean;
}
export const TaskDetailsModal = ({
  task,
  open,
  onOpenChange,
  onUpdateTask,
  onDeleteTask,
  onUnassignTask,
  openInEditMode = false
}: TaskDetailsModalProps) => {
  const [isEditing, setIsEditing] = useState(openInEditMode);
  const [formData, setFormData] = useState<Partial<Task>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { userRole } = useAuth();
  const { toast } = useToast();
  
  useEffect(() => {
    if (task) {
      console.log('🔍 TaskDetailsModal useEffect - task:', task.id, 'openInEditMode:', openInEditMode);
      setFormData(task);
      setIsEditing(openInEditMode);
      console.log('🔍 TaskDetailsModal - isEditing set to:', openInEditMode);
    }
  }, [task, openInEditMode]);
  if (!task) return null;
  const handleSave = () => {
    if (!formData.property || !formData.startTime || !formData.endTime) {
      toast({
        title: "Error",
        description: "Por favor completa los campos obligatorios.",
        variant: "destructive"
      });
      return;
    }
    onUpdateTask(task.id, formData);
    setIsEditing(false);
    toast({
      title: "Tarea actualizada",
      description: "Los cambios se han guardado correctamente."
    });
  };
  const handleDelete = () => {
    onDeleteTask(task.id);
    onOpenChange(false);
    setShowDeleteConfirm(false);
    toast({
      title: "Tarea eliminada",
      description: "La tarea se ha eliminado correctamente."
    });
  };
  const handleUnassign = () => {
    if (onUnassignTask && task.cleaner) {
      onUnassignTask(task.id);
      onOpenChange(false);
      setShowUnassignConfirm(false);
      toast({
        title: "Tarea desasignada",
        description: "La tarea se ha enviado a la lista de tareas sin asignar."
      });
    }
  };
  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleCancel = () => {
    setIsEditing(false);
    setFormData(task);
  };

  const handleAssign = async (cleanerId: string, cleanerName: string) => {
    try {
      await taskAssignmentService.assignTask(task.id, cleanerName, cleanerId);
      onUpdateTask(task.id, { cleaner: cleanerName, cleanerId });
      toast({
        title: "Tarea asignada",
        description: `La tarea ha sido asignada a ${cleanerName}.`
      });
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al asignar la tarea.",
        variant: "destructive"
      });
    }
  };
  return <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[600px] h-[90vh] sm:mx-auto mx-0 px-[25px] my-0 py-[6px] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <TaskDetailsHeader task={task} isEditing={isEditing} />
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            <TaskDetailsForm task={task} isEditing={isEditing} formData={formData} onFieldChange={handleFieldChange} />
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <TaskDetailsActions 
              task={task} 
              isEditing={isEditing} 
              onEdit={userRole !== 'cleaner' ? () => setIsEditing(true) : undefined} 
              onSave={handleSave} 
              onCancel={handleCancel} 
              onDelete={userRole !== 'cleaner' ? () => setShowDeleteConfirm(true) : undefined} 
              onUnassign={userRole !== 'cleaner' && onUnassignTask ? () => setShowUnassignConfirm(true) : undefined}
              onAssign={userRole !== 'cleaner' ? handleAssign : undefined}
              onOpenReport={() => setShowReportModal(true)} 
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Report Modal */}
      <TaskReportModal task={task} open={showReportModal} onOpenChange={setShowReportModal} />

      <TaskDetailsConfirmDialogs task={task} showDeleteConfirm={showDeleteConfirm} onDeleteConfirmChange={setShowDeleteConfirm} showUnassignConfirm={showUnassignConfirm} onUnassignConfirmChange={setShowUnassignConfirm} onConfirmDelete={handleDelete} onConfirmUnassign={handleUnassign} />
    </>;
};