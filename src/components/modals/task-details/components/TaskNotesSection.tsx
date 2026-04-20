import { Task } from "@/types/calendar";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Loader2, Check, AlertCircle } from "lucide-react";
import { FieldSaveStatus } from "@/hooks/useInlineFieldSave";
import { cn } from "@/lib/utils";

interface TaskNotesProps {
  task: Task;
  canEdit: boolean;
  formData: Partial<Task>;
  onFieldChange: (field: string, value: string) => void;
  onFieldBlur?: (field: string, value: string) => void;
  statusByField?: Record<string, FieldSaveStatus>;
}

const FieldStatus = ({ status }: { status?: FieldSaveStatus }) => {
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
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <StickyNote className="h-4 w-4 text-yellow-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notas
        </h3>
        <FieldStatus status={statusByField?.notes} />
      </div>

      {canEdit ? (
        <Textarea
          id="task-notes"
          value={notes}
          onChange={(e) => onFieldChange('notes', e.target.value)}
          onBlur={(e) => onFieldBlur?.('notes', e.target.value)}
          placeholder="Añade notas adicionales para esta tarea..."
          rows={3}
          className={cn(
            'resize-none border-0 shadow-none bg-muted/30',
            'hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30',
            'transition-colors text-sm'
          )}
        />
      ) : (
        <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-md min-h-[60px]">
          {notes || <span className="text-muted-foreground italic">Sin notas adicionales</span>}
        </div>
      )}
    </section>
  );
};
