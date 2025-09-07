import { useEffect } from 'react';
import { SedeProvider, useSede } from './SedeContext';
import { setGlobalSedeContext } from '@/services/storage/baseStorage';

/**
 * Provider wrapper que configura el contexto global para BaseStorage
 */
const SedeContextInitializer = ({ children }: { children: React.ReactNode }) => {
  const context = useSede();
  
  useEffect(() => {
    // Configurar contexto global para que BaseStorage pueda acceder a la sede activa
    const getActiveSedeId = () => {
      const sedeId = context.activeSede?.id || null;
      console.log(`🏢 SedeContextProvider.getActiveSedeId called:`, {
        activeSede: context.activeSede?.nombre || 'null',
        sedeId,
        loading: context.loading,
        availableSedesCount: context.availableSedes.length
      });
      return sedeId;
    };
    
    const waitForActiveSede = async (timeout = 5000): Promise<string> => {
      return new Promise((resolve, reject) => {
        if (context.activeSede?.id) {
          resolve(context.activeSede.id);
          return;
        }
        
        // Si el contexto no está inicializado, rechazar inmediatamente
        if (!context.isInitialized) {
          reject(new Error('SedeContext no está inicializado'));
          return;
        }
        
        // Si no hay sedes disponibles y ya se inicializó, rechazar
        if (context.availableSedes.length === 0 && context.isInitialized) {
          reject(new Error('No hay sedes disponibles para el usuario'));
          return;
        }
        
        if (context.loading || context.activeSede) {
          // Si está cargando o hay una sede, esperar un poco más
          const timeoutId = setTimeout(() => {
            reject(new Error('Timeout: No se pudo obtener una sede activa'));
          }, timeout);
          
          const interval = setInterval(() => {
            if (context.activeSede?.id) {
              clearInterval(interval);
              clearTimeout(timeoutId);
              resolve(context.activeSede.id);
            } else if (!context.loading && !context.activeSede && context.availableSedes.length === 0) {
              clearInterval(interval);
              clearTimeout(timeoutId);
              reject(new Error('No hay sedes disponibles para el usuario'));
            }
          }, 100);
        } else {
          reject(new Error('No hay sede activa y no se está cargando'));
        }
      });
    };

    console.log(`🔧 SedeContextProvider.useEffect: Configurando contexto global`, {
      activeSede: context.activeSede?.nombre || 'null',
      loading: context.loading,
      availableSedesCount: context.availableSedes.length,
      isInitialized: context.isInitialized
    });

    setGlobalSedeContext({
      getActiveSedeId,
      waitForActiveSede,
    });
  }, [context]);
  
  return <>{children}</>;
};

/**
 * Provider completo que incluye tanto SedeProvider como la configuración global
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