import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Loader2 } from 'lucide-react';
import { Task } from '@/types/calendar';
interface BulkAutoAssignButtonProps {
  unassignedTasks: Task[];
  onAssignmentComplete: () => void;
}
export const BulkAutoAssignButton = ({
  unassignedTasks,
  onAssignmentComplete
}: BulkAutoAssignButtonProps) => {
  const [isAssigning, setIsAssigning] = useState(false);
  const {
    toast
  } = useToast();
  const handleBulkAutoAssign = async () => {
    if (unassignedTasks.length === 0) {
      toast({
        title: "Sin tareas por asignar",
        description: "No hay tareas sin asignar disponibles para la asignación automática.",
        variant: "default"
      });
      return;
    }
    setIsAssigning(true);
    try {
      console.log(`🤖 Iniciando asignación automática en lote para ${unassignedTasks.length} tareas`);
      const taskIds = unassignedTasks.map(task => task.id);
      const {
        data,
        error
      } = await supabase.functions.invoke('auto-assign-tasks', {
        body: {
          taskIds
        }
      });
      if (error) {
        console.error('Error en asignación automática:', error);
        throw error;
      }
      console.log('Resultado de asignación automática:', data);
      if (data?.success && data?.summary) {
        const {
          assigned,
          total,
          failed
        } = data.summary;
        toast({
          title: "Asignación automática completada",
          description: `Se asignaron ${assigned} de ${total} tareas automáticamente. ${failed > 0 ? `${failed} tareas no pudieron ser asignadas.` : ''}`,
          variant: assigned > 0 ? "default" : "destructive"
        });

        // Actualizar la lista de tareas
        onAssignmentComplete();
      } else {
        throw new Error(data?.error || 'Error desconocido en la asignación automática');
      }
    } catch (error) {
      console.error('Error ejecutando asignación automática:', error);
      toast({
        title: "Error en asignación automática",
        description: `No se pudo completar la asignación automática: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsAssigning(false);
    }
  };
  const unassignedCount = unassignedTasks.length;
  
  return (
    <Button
      onClick={handleBulkAutoAssign}
      disabled={isAssigning || unassignedCount === 0}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      {isAssigning ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Bot className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        Asignar Automáticamente
      </span>
      <span className="sm:hidden">
        Auto
      </span>
      {unassignedCount > 0 && (
        <span className="bg-primary text-primary-foreground rounded-full px-2 py-1 text-xs">
          {unassignedCount}
        </span>
      )}
    </Button>
  );
};