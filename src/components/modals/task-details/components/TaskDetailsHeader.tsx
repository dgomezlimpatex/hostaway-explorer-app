import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Home,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  Info,
  Calendar,
  Loader2,
  Check,
} from 'lucide-react';
import { Task } from '@/types/calendar';
import { FieldSaveStatus } from '@/hooks/useInlineFieldSave';

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

export const TaskDetailsHeader = ({
  task,
  canEdit,
  formData,
  propertyData,
  onFieldChange,
  onFieldBlur,
  statusByField,
}: TaskDetailsHeaderProps) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300"><CheckCircle2 className="h-3 w-3 mr-1" />Completado</Badge>;
      case 'in-progress':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300"><Clock className="h-3 w-3 mr-1" />En Progreso</Badge>;
      case 'pending':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-300"><AlertCircle className="h-3 w-3 mr-1" />Pendiente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Home className="h-5 w-5 text-primary" />
            {canEdit ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={formData.property || ''}
                  onChange={e => onFieldChange('property', e.target.value)}
                  onBlur={e => onFieldBlur?.('property', e.target.value)}
                  className="text-lg font-semibold"
                />
                <StatusIcon status={statusByField?.property} />
              </div>
            ) : (
              task.property
            )}
          </CardTitle>
          {getStatusBadge(task.status)}
        </div>
        {propertyData?.codigo && (
          <div className="flex items-center gap-2 text-sm text-primary/80">
            <Info className="h-4 w-4" />
            <span className="font-medium">Código: {propertyData.codigo}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {canEdit ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={formData.address || ''}
                  onChange={e => onFieldChange('address', e.target.value)}
                  onBlur={e => onFieldBlur?.('address', e.target.value)}
                  placeholder="Dirección"
                />
                <StatusIcon status={statusByField?.address} />
              </div>
            ) : (
              <span>{task.address}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
