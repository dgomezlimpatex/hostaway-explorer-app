import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  WorkerAbsence, 
  ABSENCE_TYPE_CONFIG,
} from '@/types/workerAbsence';
import { 
  useDeleteWorkerAbsence,
} from '@/hooks/useWorkerAbsences';
import { Trash2, Edit2, Calendar, Clock, Loader2, FileText } from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EditAbsenceModal } from './EditAbsenceModal';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AbsencesListProps {
  cleanerId: string;
  absences: WorkerAbsence[];
  isLoading?: boolean;
}

export const AbsencesList: React.FC<AbsencesListProps> = ({
  cleanerId,
  absences,
  isLoading,
}) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<WorkerAbsence | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  
  const deleteMutation = useDeleteWorkerAbsence();

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate({ id: deleteId, cleanerId }, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'd MMM yyyy', { locale: es });
  };

  const formatTime = (time: string | null) => time ? time.slice(0, 5) : null;

  const calculateDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const filteredAbsences = filterType === 'all' 
    ? absences 
    : absences.filter(a => a.absenceType === filterType);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Lista de Ausencias
            </CardTitle>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {Object.entries(ABSENCE_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.icon} {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAbsences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {filterType === 'all' 
                  ? 'No hay ausencias registradas' 
                  : 'No hay ausencias de este tipo'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAbsences.map(absence => {
                const config = ABSENCE_TYPE_CONFIG[absence.absenceType];
                const days = calculateDays(absence.startDate, absence.endDate);
                const isHourly = absence.startTime && absence.endTime;
                
                return (
                  <div 
                    key={absence.id}
                    className="flex items-start justify-between p-3 rounded-lg border"
                    style={{ 
                      borderLeftWidth: 4, 
                      borderLeftColor: config.color 
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          variant="secondary"
                          style={{ 
                            backgroundColor: `${config.color}20`,
                            color: config.color,
                            borderColor: config.color,
                          }}
                        >
                          {config.icon} {config.label}
                        </Badge>
                        {isHourly && (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTime(absence.startTime)} - {formatTime(absence.endTime)}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {days === 1 ? '1 día' : `${days} días`}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {formatDate(absence.startDate)}
                          {absence.startDate !== absence.endDate && (
                            <> — {formatDate(absence.endDate)}</>
                          )}
                        </span>
                      </div>
                      
                      {absence.locationName && (
                        <p className="text-sm text-muted-foreground mt-1">
                          📍 {absence.locationName}
                        </p>
                      )}
                      
                      {absence.notes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {absence.notes}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setEditItem(absence)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setDeleteId(absence.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ausencia?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente esta ausencia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit modal */}
      {editItem && (
        <EditAbsenceModal
          open={!!editItem}
          onOpenChange={() => setEditItem(null)}
          absence={editItem}
        />
      )}
    </>
  );
};
