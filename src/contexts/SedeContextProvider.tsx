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
  const context = useSede();

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

  const waitForActiveSede = useCallback(async (timeout = 3000): Promise<string> => {
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

      // Si está inicializado y hay sedes disponibles pero no hay activa, auto-seleccionar la primera
      if (context?.isInitialized && !context?.loading && context?.availableSedes?.length > 0) {
        const firstSede = context.availableSedes[0];
        console.log('🎯 waitForActiveSede - auto-selecting first sede:', firstSede.nombre);
        context.setActiveSede(firstSede);
        resolve(firstSede.id);
        return;
      }

      let attempts = 0;
      const maxAttempts = Math.floor(timeout / 100);

      const interval = setInterval(() => {
        attempts++;
        
        // Verificar si ya hay sede activa
        if (context?.activeSede?.id) {
          console.log('✅ waitForActiveSede - sede found:', context.activeSede.nombre);
          clearInterval(interval);
          resolve(context.activeSede.id);
          return;
        }

        // Si está inicializado y no está cargando
        if (context?.isInitialized && !context?.loading) {
          // Si hay sedes disponibles pero no hay activa, auto-seleccionar
          if (context?.availableSedes?.length > 0) {
            const firstSede = context.availableSedes[0];
            console.log('🎯 waitForActiveSede - auto-selecting first sede (polling):', firstSede.nombre);
            context.setActiveSede(firstSede);
            clearInterval(interval);
            resolve(firstSede.id);
            return;
          }
          
          // Si no hay sedes disponibles
          if (!context?.availableSedes?.length) {
            console.error('❌ waitForActiveSede - no sedes available');
            clearInterval(interval);
            reject(new Error('No hay sedes disponibles para el usuario'));
            return;
          }
        }

        // Timeout después de intentos máximos
        if (attempts >= maxAttempts) {
          console.error('❌ waitForActiveSede - timeout after', timeout, 'ms');
          clearInterval(interval);
          reject(new Error('Timeout: No se pudo obtener una sede activa'));
        }
      }, 100);
      
      // También agregar un timeout absoluto como respaldo
      setTimeout(() => {
        clearInterval(interval);
        if (!context?.activeSede?.id) {
          console.error('❌ waitForActiveSede - absolute timeout');
          reject(new Error('Timeout: No se pudo obtener una sede activa'));
        }
      }, timeout);
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