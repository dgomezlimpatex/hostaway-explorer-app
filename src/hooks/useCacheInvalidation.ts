import { useQueryClient } from '@tanstack/react-query';
import { useSede } from '@/contexts/SedeContext';

/**
 * Hook centralizado para manejar la invalidación de cache
 * Asegura que todas las acciones aparezcan inmediatamente sin refresh
 */
export const useCacheInvalidation = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  const invalidateAll = () => {
    console.log('🔄 Invalidating all caches for sede:', activeSede?.nombre);
    
    const sedeId = activeSede?.id;
    
    // Invalidar todas las queries principales
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['task-reports'] });
    queryClient.invalidateQueries({ queryKey: ['cleaners'] });
    queryClient.invalidateQueries({ queryKey: ['properties'] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['recurring-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['cleaner-availability'] });
    
    // Invalidar con claves específicas de sede
    if (sedeId) {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all', sedeId] });
      queryClient.invalidateQueries({ queryKey: ['task-reports', sedeId] });
      queryClient.invalidateQueries({ queryKey: ['cleaners', sedeId] });
      queryClient.invalidateQueries({ queryKey: ['properties', sedeId] });
      queryClient.invalidateQueries({ queryKey: ['clients', sedeId] });
    }
    
    // Note: No hacer refetch inmediato - dejar que las queries se refresquen cuando se necesiten
  };

  const invalidateTasks = () => {
    console.log('🔄 Invalidating task caches for sede:', activeSede?.nombre);
    const sedeId = activeSede?.id;
    
    // Invalidar todas las queries que empiecen con ['tasks']
    queryClient.invalidateQueries({ 
      queryKey: ['tasks'],
      predicate: (query) => {
        const key = query.queryKey;
        return key[0] === 'tasks';
      }
    });
    
    // Si hay sedeId específico, invalidar también queries con ese sede
    if (sedeId) {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return key[0] === 'tasks' && key.includes(sedeId);
        }
      });
    }
    
    // Note: No hacer refetch inmediato - dejar que las queries se refresquen cuando se necesiten
  };

  const invalidateCleaners = () => {
    console.log('🔄 Invalidating cleaner caches');
    const sedeId = activeSede?.id;
    
    queryClient.invalidateQueries({ queryKey: ['cleaners'] });
    queryClient.invalidateQueries({ queryKey: ['cleaner-availability'] });
    if (sedeId) {
      queryClient.invalidateQueries({ queryKey: ['cleaners', sedeId] });
    }
    // Note: Invalidación sin refetch inmediato
  };

  const invalidateProperties = () => {
    console.log('🔄 Invalidating property caches');
    const sedeId = activeSede?.id;
    
    queryClient.invalidateQueries({ queryKey: ['properties'] });
    if (sedeId) {
      queryClient.invalidateQueries({ queryKey: ['properties', sedeId] });
    }
    // Note: Invalidación sin refetch inmediato
  };

  const invalidateClients = () => {
    console.log('🔄 Invalidating client caches');
    const sedeId = activeSede?.id;
    
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    if (sedeId) {
      queryClient.invalidateQueries({ queryKey: ['clients', sedeId] });
    }
    // Note: Invalidación sin refetch inmediato
  };

  const invalidateReports = () => {
    console.log('🔄 Invalidating report caches');
    const sedeId = activeSede?.id;
    
    queryClient.invalidateQueries({ queryKey: ['task-reports'] });
    if (sedeId) {
      queryClient.invalidateQueries({ queryKey: ['task-reports', sedeId] });
    }
    // Note: Invalidación sin refetch inmediato
  };

  return {
    invalidateAll,
    invalidateTasks,
    invalidateCleaners,
    invalidateProperties,
    invalidateClients,
    invalidateReports,
  };
};