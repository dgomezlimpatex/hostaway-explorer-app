import React from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Check,
  Hash,
} from 'lucide-react';
import { Task } from '@/types/calendar';
import { FieldSaveStatus } from '@/hooks/useInlineFieldSave';
import { cn } from '@/lib/utils';

interface TaskDetailsHeaderProps {
  task: Task;
  canEdit: boolean;
  formData: Partial<Task>;
  propertyData: any;
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

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
          <CheckCircle2 className="h-3 w-3" />
          Completado
        </Badge>
      );
    case 'in-progress':
      return (
        <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200 font-medium">
          <Clock className="h-3 w-3" />
          En progreso
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="gap-1 bg-rose-50 text-rose-700 border-rose-200 font-medium">
          <AlertCircle className="h-3 w-3" />
          Pendiente
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export const TaskDetailsHeader = ({
  task,
  canEdit,
  formData,
  propertyData,
  onFieldChange,
  onFieldBlur,
  statusByField,
}: TaskDetailsHeaderProps) => {
  return (
    <div className="space-y-3 pb-2">
      {/* Property name + status badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {canEdit ? (
            <div className="flex items-center gap-2 group">
              <Input
                value={formData.property || ''}
                onChange={e => onFieldChange('property', e.target.value)}
                onBlur={e => onFieldBlur?.('property', e.target.value)}
                className={cn(
                  'text-2xl font-semibold border-0 shadow-none px-0 h-auto py-1',
                  'focus-visible:ring-0 focus-visible:bg-muted/40 rounded-md',
                  'hover:bg-muted/30 transition-colors'
                )}
              />
              <StatusIcon status={statusByField?.property} />
            </div>
          ) : (
            <h2 className="text-2xl font-semibold text-foreground leading-tight">{task.property}</h2>
          )}
          {propertyData?.codigo && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Hash className="h-3 w-3" />
              <span className="font-mono">{propertyData.codigo}</span>
            </div>
          )}
        </div>
        {getStatusBadge(task.status)}
      </div>

      {/* Address */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground group">
        <MapPin className="h-4 w-4 text-rose-500 flex-shrink-0" />
        {canEdit ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={formData.address || ''}
              onChange={e => onFieldChange('address', e.target.value)}
              onBlur={e => onFieldBlur?.('address', e.target.value)}
              placeholder="Dirección"
              className={cn(
                'border-0 shadow-none px-2 h-8 bg-transparent',
                'focus-visible:ring-0 focus-visible:bg-muted/40 rounded-md',
                'hover:bg-muted/30 transition-colors text-sm'
              )}
            />
            <StatusIcon status={statusByField?.address} />
          </div>
        ) : (
          <span>{task.address}</span>
        )}
      </div>
    </div>
  );
};
