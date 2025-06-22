
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Task } from "@/types/calendar";

interface TaskDetailsConfirmDialogsProps {
  task: Task;
  showDeleteConfirm: boolean;
  onDeleteConfirmChange: (open: boolean) => void;
  showUnassignConfirm: boolean;
  onUnassignConfirmChange: (open: boolean) => void;
  onConfirmDelete: () => void;
  onConfirmUnassign: () => void;
}

export const TaskDetailsConfirmDialogs = ({
  task,
  showDeleteConfirm,
  onDeleteConfirmChange,
  showUnassignConfirm,
  onUnassignConfirmChange,
  onConfirmDelete,
  onConfirmUnassign
}: TaskDetailsConfirmDialogsProps) => {
  return (
    <>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={onDeleteConfirmChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar esta tarea? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unassign Confirmation Dialog */}
      <AlertDialog open={showUnassignConfirm} onOpenChange={onUnassignConfirmChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desasignar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres desasignar esta tarea de {task.cleaner}? La tarea se enviará a la lista de tareas sin asignar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmUnassign}>
              Desasignar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
