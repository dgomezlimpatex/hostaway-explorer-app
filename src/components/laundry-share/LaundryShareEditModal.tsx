import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trash2, Home, Calendar, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LaundryShareLink } from '@/hooks/useLaundryShareLinks';

interface LaundryShareEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink: LaundryShareLink | null;
}

interface TaskItem {
  id: string;
  property: string;
  code: string;
  clientName: string;
  date: string;
  checkOut: string;
}

export const LaundryShareEditModal = ({
  open,
  onOpenChange,
  shareLink,
}: LaundryShareEditModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [excludedTasks, setExcludedTasks] = useState<Set<string>>(new Set());

  // Fetch tasks for this share link's date range
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['share-link-edit-tasks', shareLink?.id],
    queryFn: async () => {
      if (!shareLink) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          property,
          date,
          check_out,
          properties (
            codigo,
            clients (nombre)
          )
        `)
        .gte('date', shareLink.dateStart)
        .lte('date', shareLink.dateEnd);

      if (error) throw error;

      // Sort by date first, then by code alphabetically
      const sorted = (data || []).sort((a, b) => {
        // First sort by date
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        
        // Then sort alphabetically by code
        const codeA = (a.properties as any)?.codigo || a.property || '';
        const codeB = (b.properties as any)?.codigo || b.property || '';
        return codeA.localeCompare(codeB, 'es', { numeric: true });
      });

      return sorted.map(t => ({
        id: t.id,
        property: t.property,
        code: (t.properties as any)?.codigo || '',
        clientName: (t.properties as any)?.clients?.nombre || '',
        date: t.date,
        checkOut: t.check_out,
      })) as TaskItem[];
    },
    enabled: !!shareLink && open,
  });

  // Initialize excluded tasks from snapshot
  useEffect(() => {
    if (shareLink && tasks) {
      const snapshotSet = new Set(shareLink.snapshotTaskIds);
      const currentTaskIds = tasks.map(t => t.id);
      // Tasks that exist but are NOT in snapshot are excluded
      const excluded = currentTaskIds.filter(id => !snapshotSet.has(id));
      setExcludedTasks(new Set(excluded));
    }
  }, [shareLink, tasks]);

  // Update share link mutation
  const updateShareLink = useMutation({
    mutationFn: async (includedTaskIds: string[]) => {
      if (!shareLink) throw new Error('No share link');

      const { error } = await supabase
        .from('laundry_share_links')
        .update({ snapshot_task_ids: includedTaskIds })
        .eq('id', shareLink.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laundry-share-links'] });
      queryClient.invalidateQueries({ queryKey: ['share-link-properties'] });
      toast({
        title: 'Enlace actualizado',
        description: 'Las tareas del enlace han sido actualizadas',
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating share link:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el enlace',
        variant: 'destructive',
      });
    },
  });

  const toggleTask = (taskId: string) => {
    setExcludedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleSave = () => {
    if (!tasks) return;
    const includedTaskIds = tasks.filter(t => !excludedTasks.has(t.id)).map(t => t.id);
    updateShareLink.mutate(includedTaskIds);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const includedCount = tasks ? tasks.length - excludedTasks.size : 0;
  const totalCount = tasks?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Tareas del Enlace</DialogTitle>
          <DialogDescription>
            Selecciona las tareas que quieres incluir en este enlace compartible.
            Las tareas desmarcadas no aparecerán para los repartidores.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tasks && tasks.length > 0 ? (
          <>
            <div className="text-sm text-muted-foreground mb-2">
              {includedCount} de {totalCount} tareas incluidas
            </div>
            <ScrollArea className="h-[600px] pr-4">
              <div className="columns-1 md:columns-2 xl:columns-3 gap-4">
              {(() => {
                  let lastDate = '';
                  // Determine which tasks are truly new (not in originalTaskIds)
                  const originalTaskSet = new Set(shareLink?.originalTaskIds || []);
                  
                  return tasks.map(task => {
                    const isIncluded = !excludedTasks.has(task.id);
                    const isNewTask = originalTaskSet.size > 0 && !originalTaskSet.has(task.id);
                    const showDateHeader = task.date !== lastDate;
                    lastDate = task.date;
                    
                    return (
                      <div key={task.id} className="break-inside-avoid mb-2">
                        {showDateHeader && (
                          <div className="flex items-center gap-2 py-2 mb-2 border-b border-border">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-sm text-primary">
                              {formatDate(task.date)}
                            </span>
                          </div>
                        )}
                        <div
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isNewTask
                              ? 'bg-emerald-500/10 border-emerald-500/50 hover:bg-emerald-500/20'
                              : isIncluded 
                                ? 'bg-card hover:bg-muted/50' 
                                : 'bg-muted/30 opacity-60'
                          }`}
                          onClick={() => toggleTask(task.id)}
                        >
                          <Checkbox
                            checked={isIncluded}
                            onCheckedChange={() => toggleTask(task.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">
                                {task.code || task.property}
                              </span>
                              {task.clientName && (
                                <span className="text-xs text-muted-foreground truncate">
                                  ({task.clientName})
                                </span>
                              )}
                              {isNewTask && (
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4 shrink-0">
                                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                  Nueva
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Check-out: {task.checkOut}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No hay tareas en este rango de fechas
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateShareLink.isPending || includedCount === 0}
          >
            {updateShareLink.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};