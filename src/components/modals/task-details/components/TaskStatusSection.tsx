import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CircleDot, Loader2, Check, AlertCircle } from 'lucide-react';
import { Task } from '@/types/calendar';
import { FieldSaveStatus } from '@/hooks/useInlineFieldSave';
import { cn } from '@/lib/utils';

interface TaskStatusSectionProps {
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

export const TaskStatusSection = ({ formData, onFieldChange, onFieldBlur, statusByField }: TaskStatusSectionProps) => {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <CircleDot className="h-4 w-4 text-purple-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado</h3>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-16 flex-shrink-0">Estado</span>
        <Select
          value={formData.status}
          onValueChange={value => {
            onFieldChange('status', value);
            onFieldBlur?.('status', value);
          }}
        >
          <SelectTrigger
            className={cn(
              'h-8 w-auto min-w-[160px] px-2 border-0 shadow-none bg-muted/40',
              'hover:bg-muted/70 focus:ring-1 focus:ring-primary/30 transition-colors'
            )}
          >
            <SelectValue placeholder="Seleccionar estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="in-progress">En progreso</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
          </SelectContent>
        </Select>
        <FieldStatus status={statusByField?.status} />
      </div>
    </section>
  );
};
