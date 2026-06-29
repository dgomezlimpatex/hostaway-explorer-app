import { useSede } from '@/contexts/SedeContext';

/**
 * Hook para acceder de forma robusta al contexto de sede
 * Proporciona métodos seguros para obtener la sede activa
 */
export const useSedeContext = () => {
  const context = useSede();
  
  const getActiveSedeId = (): string | null => {
    return context.activeSede?.id || null;
  };
  
  const getActiveSede = () => {
    return context.activeSede;
  };
  
  const isSedeActive = (): boolean => {
    return context.activeSede !== null;
  };
  
  const waitForActiveSede = async (timeout = 5000): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (context.activeSede?.id) {
        resolve(context.activeSede.id);
        return;
      }

      if (context.availableSedes.length > 0) {
        const preferredSede = context.availableSedes[0];
        context.setActiveSede(preferredSede);
        resolve(preferredSede.id);
        return;
      }

      const interval = setInterval(() => {
        if (context.activeSede?.id) {
          clearInterval(interval);
          clearTimeout(timeoutId);
          resolve(context.activeSede.id);
        } else if (!context.loading && context.isInitialized && context.availableSedes.length === 0) {
          clearInterval(interval);
          clearTimeout(timeoutId);
          reject(new Error('No hay sedes disponibles para el usuario'));
        } else if (context.availableSedes.length > 0) {
          clearInterval(interval);
          clearTimeout(timeoutId);
          const preferredSede = context.availableSedes[0];
          context.setActiveSede(preferredSede);
          resolve(preferredSede.id);
        }
      }, 100);

      const timeoutId = setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Timeout: No se pudo obtener una sede activa'));
      }, timeout);
    });
  };
  
  return {
    ...context,
    getActiveSedeId,
    getActiveSede,
    isSedeActive,
    waitForActiveSede,
  };
};