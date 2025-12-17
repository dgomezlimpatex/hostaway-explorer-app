import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkerAbsenceAuditLog } from '@/hooks/useWorkerAbsenceAuditLog';
import { WorkerAbsenceAuditLog as AuditLogType, ABSENCE_TYPE_CONFIG, DAY_OF_WEEK_SHORT } from '@/types/workerAbsence';
import { History, Plus, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AbsenceAuditLogProps {
  cleanerId: string;
}

export const AbsenceAuditLog: React.FC<AbsenceAuditLogProps> = ({ cleanerId }) => {
  const { data: logs = [], isLoading } = useWorkerAbsenceAuditLog(cleanerId);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return <Plus className="h-3 w-3 text-green-500" />;
      case 'updated': return <Pencil className="h-3 w-3 text-blue-500" />;
      case 'deleted': return <Trash2 className="h-3 w-3 text-red-500" />;
      default: return null;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return 'Creado';
      case 'updated': return 'Modificado';
      case 'deleted': return 'Eliminado';
      default: return action;
    }
  };

  const getReferenceTypeLabel = (type: string) => {
    switch (type) {
      case 'absence': return 'Ausencia';
      case 'fixed_day_off': return 'Día libre fijo';
      case 'maintenance_cleaning': return 'Limpieza mant.';
      default: return type;
    }
  };

  const formatLogDetails = (log: AuditLogType): string => {
    const data = log.newData || log.oldData;
    if (!data) return '';

    if (log.referenceType === 'absence') {
      const type = data.absence_type as string;
      const config = ABSENCE_TYPE_CONFIG[type as keyof typeof ABSENCE_TYPE_CONFIG];
      const startDate = data.start_date ? format(new Date(data.start_date), 'd MMM', { locale: es }) : '';
      const endDate = data.end_date ? format(new Date(data.end_date), 'd MMM', { locale: es }) : '';
      return `${config?.icon || ''} ${config?.label || type} (${startDate}${startDate !== endDate ? ` - ${endDate}` : ''})`;
    }

    if (log.referenceType === 'fixed_day_off') {
      const day = data.day_of_week as number;
      return `📅 ${DAY_OF_WEEK_SHORT[day]}`;
    }

    if (log.referenceType === 'maintenance_cleaning') {
      const location = data.location_name as string;
      const days = (data.days_of_week as number[])?.map(d => DAY_OF_WEEK_SHORT[d]).join(', ');
      return `🧹 ${location} (${days})`;
    }

    return '';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Historial de Cambios
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay historial de cambios</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {logs.map(log => (
                <div 
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <div className="mt-0.5">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {getReferenceTypeLabel(log.referenceType)}
                      </Badge>
                      <span className="text-xs font-medium">
                        {getActionLabel(log.action)}
                      </span>
                    </div>
                    <p className="text-sm mt-1 truncate">
                      {formatLogDetails(log)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(log.changedAt), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
