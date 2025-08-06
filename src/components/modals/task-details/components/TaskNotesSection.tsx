import { Task } from "@/types/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StickyNote } from "lucide-react";

interface TaskNotesProps {
  task: Task;
  isEditing: boolean;
  formData: Partial<Task>;
  onFieldChange: (field: string, value: string) => void;
}

export const TaskNotesSection = ({
  task,
  isEditing,
  formData,
  onFieldChange
}: TaskNotesProps) => {
  const notes = isEditing ? (formData.notes || '') : (task.notes || '');
  
  console.log('🔍 TaskNotesSection - DEBUGGING:', { 
    taskId: task.id, 
    taskNotes: task.notes, 
    formDataNotes: formData.notes, 
    finalNotes: notes, 
    isEditing,
    hasNotes: !!notes
  });

  // SIEMPRE mostrar la sección de notas, independientemente del rol
  // if (!notes && isEditing) {
  //   return null;
  // }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          Notas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isEditing ? (
          <div className="space-y-2">
            <Label htmlFor="task-notes" className="sr-only">
              Notas de la tarea
            </Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => onFieldChange('notes', e.target.value)}
              placeholder="Añade notas adicionales para esta tarea..."
              rows={3}
              className="resize-none"
            />
          </div>
        ) : (
          <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
            {notes || 'Sin notas adicionales'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};