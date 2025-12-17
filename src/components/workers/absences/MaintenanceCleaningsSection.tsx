import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  WorkerMaintenanceCleaning, 
  DAY_OF_WEEK_SHORT 
} from '@/types/workerAbsence';
import { 
  useDeleteWorkerMaintenanceCleaning,
  useUpdateWorkerMaintenanceCleaning 
} from '@/hooks/useWorkerMaintenanceCleanings';
import { Plus, Trash2, Edit2, Building2, Clock, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
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
import { EditMaintenanceModal } from './EditMaintenanceModal';

interface MaintenanceCleaningsSectionProps {
  cleanerId: string;
  cleanerName: string;
  maintenanceCleanings: WorkerMaintenanceCleaning[];
  onAddNew: () => void;
}

export const MaintenanceCleaningsSection: React.FC<MaintenanceCleaningsSectionProps> = ({
  cleanerId,
  cleanerName,
  maintenanceCleanings,
  onAddNew,
}) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<WorkerMaintenanceCleaning | null>(null);
  
  const deleteMutation = useDeleteWorkerMaintenanceCleaning();
  const updateMutation = useUpdateWorkerMaintenanceCleaning();

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate({ id: deleteId, cleanerId }, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  const handleToggleActive = (item: WorkerMaintenanceCleaning) => {
    updateMutation.mutate({
      id: item.id,
      isActive: !item.isActive,
    });
  };

  const formatTime = (time: string) => time.slice(0, 5);

  const formatDays = (days: number[]): string => {
    return days
      .sort((a, b) => {
        const orderA = a === 0 ? 7 : a;
        const orderB = b === 0 ? 7 : b;
        return orderA - orderB;
      })
      .map(d => DAY_OF_WEEK_SHORT[d])
      .join(', ');
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Limpiezas de Mantenimiento
              </CardTitle>
              <CardDescription>
                Compromisos de limpieza externos fijos semanales
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onAddNew}>
              <Plus className="h-4 w-4 mr-1" />
              Añadir
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {maintenanceCleanings.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay limpiezas de mantenimiento configuradas</p>
              <Button 
                variant="link" 
                size="sm" 
                onClick={onAddNew}
                className="mt-1"
              >
                Añadir primera limpieza
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {maintenanceCleanings.map(item => (
                <div 
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    item.isActive ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800' : 'bg-muted/50 border-muted'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.locationName}</span>
                      {!item.isActive && (
                        <Badge variant="outline" className="text-xs">Inactivo</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(item.startTime)} - {formatTime(item.endTime)}
                      </span>
                      <span>{formatDays(item.daysOfWeek)}</span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.isActive}
                      onCheckedChange={() => handleToggleActive(item)}
                      disabled={updateMutation.isPending}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setEditItem(item)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setDeleteId(item.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar limpieza de mantenimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente esta limpieza de mantenimiento.
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
        <EditMaintenanceModal
          open={!!editItem}
          onOpenChange={() => setEditItem(null)}
          maintenance={editItem}
          cleanerName={cleanerName}
        />
      )}
    </>
  );
};
