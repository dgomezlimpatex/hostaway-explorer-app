import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Loader2, Check, AlertCircle } from 'lucide-react';
import { Task } from '@/types/calendar';
import { FieldSaveStatus } from '@/hooks/useInlineFieldSave';

interface TaskStatusSectionProps {
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

export const TaskStatusSection = ({ formData, onFieldChange, onFieldBlur, statusByField }: TaskStatusSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          Estado de la Tarea
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
            Estado
            <StatusIcon status={statusByField?.status} />
          </Label>
          <Select
            value={formData.status}
            onValueChange={value => {
              onFieldChange('status', value);
              // Selects don't have blur — save immediately
              onFieldBlur?.('status', value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in-progress">En Progreso</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
