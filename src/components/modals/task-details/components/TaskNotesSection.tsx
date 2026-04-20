import { Task } from "@/types/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StickyNote, Loader2, Check, AlertCircle } from "lucide-react";
import { FieldSaveStatus } from "@/hooks/useInlineFieldSave";

interface TaskNotesProps {
  task: Task;
  canEdit: boolean;
  formData: Partial<Task>;
  onFieldChange: (field: string, value: string) => void;
  onFieldBlur?: (field: string, value: string) => void;
  statusByField?: Record<string, FieldSaveStatus>;
}

const StatusIcon = ({ status }: { status?: FieldSaveStatus }) => {
  if (!status || status === 'idle') return null;
  if (status === 'saving') return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  if (status === 'saved') return <Check className="h-3 w-3 text-emerald-600" />;
  if (status === 'error') return <AlertCircle className="h-3 w-3 text-destructive" />;
  return null;
};

export const TaskNotesSection = ({
  task,
  canEdit,
  formData,
  onFieldChange,
  onFieldBlur,
  statusByField,
}: TaskNotesProps) => {
  const notes = canEdit ? (formData.notes || '') : (task.notes || '');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          Notas de la tarea
          <StatusIcon status={statusByField?.notes} />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {canEdit ? (
          <div className="space-y-2">
            <Label htmlFor="task-notes" className="sr-only">Notas de la tarea</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => onFieldChange('notes', e.target.value)}
              onBlur={(e) => onFieldBlur?.('notes', e.target.value)}
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
