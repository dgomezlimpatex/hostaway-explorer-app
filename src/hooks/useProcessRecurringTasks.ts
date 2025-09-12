import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ProcessRecurringTasksResponse {
  message: string;
  processed: number;
  generatedTasks: Array<{ id: string; name: string }>;
  updatedRecurringTasks: number;
}

export const useProcessRecurringTasks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<ProcessRecurringTasksResponse> => {
      console.log('🔄 Calling process-recurring-tasks function...');
      
      const { data, error } = await supabase.functions.invoke('process-recurring-tasks', {
        body: { source: 'manual' }
      });

      if (error) {
        console.error('❌ Error calling function:', error);
        throw new Error(error.message || 'Error al procesar tareas recurrentes');
      }

      console.log('✅ Function response:', data);
      return data;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['recurring-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      if (data.processed > 0) {
        toast({
          title: "✅ Tareas procesadas exitosamente",
          description: `Se generaron ${data.processed} nuevas tareas desde plantillas recurrentes.`,
        });
      } else {
        toast({
          title: "ℹ️ Procesamiento completado",
          description: "No había tareas recurrentes pendientes de procesar.",
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ Process recurring tasks error:', error);
      toast({
        title: "❌ Error",
        description: error.message || "Ha ocurrido un error al procesar las tareas recurrentes.",
        variant: "destructive",
      });
    },
  });
};