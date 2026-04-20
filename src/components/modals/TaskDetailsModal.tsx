import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Task } from "@/types/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from '@tanstack/react-query';
import { TaskReportModal } from "./TaskReportModal";
import { AssignMultipleCleanersModal } from "./AssignMultipleCleanersModal";
import { TaskDetailsForm } from "./task-details/TaskDetailsForm";
import { TaskDetailsActions } from "./task-details/TaskDetailsActions";
import { TaskDetailsConfirmDialogs } from "./task-details/TaskDetailsConfirmDialogs";
import { taskAssignmentService } from "@/services/storage/taskAssignmentService";
import { useInlineFieldSave } from "@/hooks/useInlineFieldSave";

interface TaskDetailsModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onUnassignTask?: (taskId: string) => void;
  onCreateTask?: (taskData: Omit<Task, 'id'>) => Promise<void>;
  /** @deprecated kept for compatibility - inline editing is always on for admins/managers */
  openInEditMode?: boolean;
}

export const TaskDetailsModal = ({
  task,
  open,
  onOpenChange,
  onUpdateTask,
  onDeleteTask,
  onUnassignTask,
  onCreateTask,
}: TaskDetailsModalProps) => {
  const [formData, setFormData] = useState<Partial<Task>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAssignMultipleModal, setShowAssignMultipleModal] = useState(false);
  const { userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isRecurringInstance = !!(task as any)?.isRecurringInstance;
  const realTaskId = task?.originalTaskId || task?.id || '';
  const canEdit = userRole !== 'cleaner' && !isRecurringInstance;

  const { saveField, statusByField } = useInlineFieldSave({ taskId: realTaskId });

  useEffect(() => {
    if (task) setFormData(task);
  }, [task]);

  // Local state update only (used for typing)
  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };

      // Keep duration coherent: changing startTime keeps duration → recompute endTime
      if (field === 'startTime' && value && task) {
        try {
          const normalize = (t: string) => (t.includes(':') ? t.substring(0, 5) : t);
          const cur = task.startTime;
          const curEnd = task.endTime;
          if (cur && curEnd) {
            const re = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            const ns = normalize(cur), ne = normalize(curEnd), nv = normalize(value);
            if (re.test(ns) && re.test(ne) && re.test(nv)) {
              const [sh, sm] = ns.split(':').map(Number);
              const [eh, em] = ne.split(':').map(Number);
              let dur = (eh * 60 + em) - (sh * 60 + sm);
              if (dur < 0) dur += 24 * 60;
              const [nh, nm] = nv.split(':').map(Number);
              const totalEnd = nh * 60 + nm + dur;
              const eH = Math.floor(totalEnd / 60) % 24;
              const eM = totalEnd % 60;
              newData.endTime = `${eH.toString().padStart(2, '0')}:${eM.toString().padStart(2, '0')}`;
            }
          }
        } catch (err) {
          console.error('handleFieldChange recompute error', err);
        }
      }
      return newData;
    });
  }, [task]);

  // Persist field on blur (autosave). Recurring instances are not autosaved.
  const handleFieldBlur = useCallback(
    (field: string, value: string) => {
      if (!canEdit || isRecurringInstance || !task) return;
      const original = (task as any)[field];
      if (value === original) return; // no change

      const updates: Partial<Task> = { [field]: value } as any;

      // If startTime changed, also persist the recomputed endTime
      if (field === 'startTime') {
        const newEnd = formData.endTime;
        if (newEnd && newEnd !== task.endTime) {
          updates.endTime = newEnd;
        }
      }
      saveField(updates, field);
    },
    [canEdit, isRecurringInstance, task, formData.endTime, saveField]
  );

  // Save multiple schedule fields at once (used by date / duration shortcuts)
  const handleScheduleSave = useCallback(
    (updates: Partial<Task>) => {
      if (!canEdit || isRecurringInstance) return;
      saveField(updates, 'schedule');
    },
    [canEdit, isRecurringInstance, saveField]
  );

  if (!task) return null;

  const handleDelete = async () => {
    if (isRecurringInstance) {
      try {
        const recurringTaskId = (task as any).recurringTaskId;
        if (recurringTaskId) {
          await supabase.from('recurring_task_executions').insert({
            recurring_task_id: recurringTaskId,
            execution_date: task.date,
            success: true,
          });
          queryClient.invalidateQueries({ queryKey: ['recurring-task-executions'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
        onOpenChange(false);
        setShowDeleteConfirm(false);
        toast({
          title: "Ocurrencia eliminada",
          description: "Esta ocurrencia de la tarea recurrente ha sido eliminada.",
        });
        return;
      } catch (error) {
        console.error('❌ Error deleting recurring instance:', error);
        toast({ title: "Error", description: "No se pudo eliminar esta ocurrencia.", variant: "destructive" });
        return;
      }
    }

    onDeleteTask(realTaskId);
    onOpenChange(false);
    setShowDeleteConfirm(false);
    toast({ title: "Tarea eliminada", description: "La tarea se ha eliminado correctamente." });
  };

  const handleUnassign = async () => {
    if (isRecurringInstance && onCreateTask) {
      try {
        const recurringTaskId = (task as any).recurringTaskId;
        const { id, isRecurringInstance: _isRec, recurringTaskId: _rtId, originalTaskId, cleaner, cleanerId, ...taskBase } = task as any;
        const newTaskData: Omit<Task, 'id'> = {
          ...taskBase,
          cleaner: undefined,
          cleanerId: undefined,
          status: formData.status || 'pending',
        };
        delete (newTaskData as any).isRecurringInstance;
        delete (newTaskData as any).recurringTaskId;
        delete (newTaskData as any).originalTaskId;

        await onCreateTask(newTaskData);

        if (recurringTaskId) {
          await supabase.from('recurring_task_executions').insert({
            recurring_task_id: recurringTaskId,
            execution_date: task.date,
            success: true,
          });
          queryClient.invalidateQueries({ queryKey: ['recurring-task-executions'] });
        }

        onOpenChange(false);
        setShowUnassignConfirm(false);
        toast({
          title: "Ocurrencia desasignada",
          description: "Se ha creado una tarea individual sin asignar para esta fecha.",
        });
        return;
      } catch (error) {
        console.error('❌ Error unassigning recurring instance:', error);
        toast({ title: "Error", description: "No se pudo desasignar esta ocurrencia.", variant: "destructive" });
        return;
      }
    }

    if (onUnassignTask && task.cleaner) {
      onUnassignTask(realTaskId);
      onOpenChange(false);
      setShowUnassignConfirm(false);
    }
  };

  const handleAssign = async (cleanerId: string, cleanerName: string) => {
    try {
      await taskAssignmentService.assignTask(realTaskId, cleanerName, cleanerId);
      onUpdateTask(realTaskId, { cleaner: cleanerName, cleanerId });
      toast({ title: "Tarea asignada", description: `La tarea ha sido asignada a ${cleanerName}.` });
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({ title: "Error", description: "No se pudo asignar la tarea.", variant: "destructive" });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[640px] h-[90vh] sm:mx-auto mx-0 px-0 my-0 py-0 flex flex-col gap-0 overflow-hidden">
          {isRecurringInstance && (
            <DialogHeader className="flex-shrink-0 px-6 pt-4 pb-2">
              <div className="text-xs text-muted-foreground italic">
                Tarea recurrente — guarda los cambios desde el botón de la sección recurrente para materializarla.
              </div>
            </DialogHeader>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <TaskDetailsForm
              task={task}
              canEdit={canEdit}
              formData={formData}
              onFieldChange={handleFieldChange}
              onFieldBlur={handleFieldBlur}
              onScheduleSave={handleScheduleSave}
              statusByField={statusByField}
            />
          </div>

          <DialogFooter className="flex-shrink-0 border-t bg-muted/20 px-6 py-3">
            <TaskDetailsActions
              task={task}
              onDelete={canEdit ? () => setShowDeleteConfirm(true) : undefined}
              onUnassign={canEdit && onUnassignTask ? () => setShowUnassignConfirm(true) : undefined}
              onAssign={canEdit ? handleAssign : undefined}
              onAssignMultiple={canEdit ? () => setShowAssignMultipleModal(true) : undefined}
              onOpenReport={() => setShowReportModal(true)}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskReportModal task={task} open={showReportModal} onOpenChange={setShowReportModal} />

      <AssignMultipleCleanersModal
        task={task}
        open={showAssignMultipleModal}
        onOpenChange={setShowAssignMultipleModal}
        onAssignComplete={() => {}}
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
