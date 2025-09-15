import { useEffect, useCallback } from 'react';
import { SedeProvider, useSede } from './SedeContext';
import { setGlobalSedeContext } from '@/services/storage/baseStorage';

/**
 * Provider completo que incluye SedeProvider y configuración del contexto global
 */
export const SedeContextProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SedeProvider>
      <SedeContextInitializer>
        {children}
      </SedeContextInitializer>
    </SedeProvider>
  );
};

/**
 * Component interno que configura el contexto global después de que SedeProvider esté listo
 */
const SedeContextInitializer = ({ children }: { children: React.ReactNode }) => {
  let context;
  
  try {
    context = useSede();
  } catch (error) {
    console.error('❌ SedeContextInitializer: Error accessing sede context:', error);
    return <>{children}</>;
  }

  const getActiveSedeId = useCallback(() => {
    if (!context || !context.activeSede) {
      return null;
    }
    const sedeId = context.activeSede.id;
    console.log(`🏢 Global Context getActiveSedeId:`, {
      activeSede: context.activeSede.nombre,
      sedeId,
      loading: context.loading,
      isInitialized: context.isInitialized
    });
    return sedeId;
  }, [context]);

  const waitForActiveSede = useCallback(async (timeout = 15000): Promise<string> => {
    return new Promise((resolve, reject) => {
      console.log('⏳ waitForActiveSede started:', {
        currentActiveSede: context?.activeSede?.nombre || 'none',
        loading: context?.loading,
        isInitialized: context?.isInitialized,
        availableSedesCount: context?.availableSedes?.length || 0
      });

      // Si ya hay sede activa, resolver inmediatamente
      if (context?.activeSede?.id) {
        console.log('✅ waitForActiveSede - sede found immediately:', context.activeSede.nombre);
        resolve(context.activeSede.id);
        return;
      }

      const timeoutId = setTimeout(() => {
        console.error('❌ waitForActiveSede - timeout after', timeout, 'ms');
        reject(new Error('Timeout: No se pudo obtener una sede activa'));
      }, timeout);

      const interval = setInterval(() => {
        // Verificar si ya hay sede activa
        if (context?.activeSede?.id) {
          console.log('✅ waitForActiveSede - sede found:', context.activeSede.nombre);
          clearInterval(interval);
          clearTimeout(timeoutId);
          resolve(context.activeSede.id);
          return;
        }

        // Si está inicializado y no está cargando
        if (context?.isInitialized && !context?.loading) {
          // Si no hay sedes disponibles
          if (!context?.availableSedes?.length) {
            console.error('❌ waitForActiveSede - no sedes available');
            clearInterval(interval);
            clearTimeout(timeoutId);
            reject(new Error('No hay sedes disponibles para el usuario'));
            return;
          }
        }
      }, 100);
    });
  }, [context]);

  useEffect(() => {
    if (!context) {
      console.warn('🚫 SedeContextInitializer: Context not ready yet');
      return;
    }

    console.log('🔧 SedeContextInitializer: Configurando contexto global', {
      activeSede: context.activeSede?.nombre || 'null',
      loading: context.loading,
      isInitialized: context.isInitialized,
      availableSedesCount: context.availableSedes.length
    });

    // Configurar contexto global para BaseStorage
    setGlobalSedeContext({
      getActiveSedeId,
      waitForActiveSede,
    });
  }, [context, getActiveSedeId, waitForActiveSede]);

  return <>{children}</>;
};