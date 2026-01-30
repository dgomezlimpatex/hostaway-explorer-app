import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sede, SedeContextType } from '@/types/sede';
import { sedeStorageService } from '@/services/storage/sedeStorage';
import { useAuth } from '@/hooks/useAuth';
import { setGlobalSedeContext } from '@/services/storage/baseStorage';

const SedeContext = createContext<SedeContextType | undefined>(undefined);

const ACTIVE_SEDE_KEY = 'activeSede';

interface SedeProviderProps {
  children: ReactNode;
}

export const SedeProvider = ({ children }: SedeProviderProps) => {
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const [availableSedes, setAvailableSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Restaurar sede inmediatamente al montar (antes de cualquier efecto async)
  // Esto usa un inicializador de estado para ejecutarse sincrónicamente en el primer render
  const [activeSede, setActiveSedeState] = useState<Sede | null>(() => {
    try {
      const savedSede = localStorage.getItem(ACTIVE_SEDE_KEY);
      if (savedSede) {
        const parsedSede = JSON.parse(savedSede) as Sede;
        console.log('🏢 SedeContext: Restored sede from localStorage immediately:', parsedSede.nombre);
        return parsedSede;
      }
    } catch (error) {
      console.error('Error parsing saved sede on init:', error);
      localStorage.removeItem(ACTIVE_SEDE_KEY);
    }
    return null;
  });

  // Función helper para restaurar desde localStorage (usada en refreshSedes)
  const restoreSedeFromStorage = useCallback((): Sede | null => {
    try {
      const savedSede = localStorage.getItem(ACTIVE_SEDE_KEY);
      if (savedSede) {
        const parsedSede = JSON.parse(savedSede) as Sede;
        return parsedSede;
      }
    } catch (error) {
      console.error('Error parsing saved sede:', error);
      localStorage.removeItem(ACTIVE_SEDE_KEY);
    }
    return null;
  }, []);

  // Función para sincronizar sede activa con sedes disponibles
  const syncActiveSede = useCallback((sedes: Sede[], currentActiveSede: Sede | null) => {
    if (sedes.length === 0) {
      // No hay sedes disponibles, limpiar sede activa
      setActiveSedeState(null);
      localStorage.removeItem(ACTIVE_SEDE_KEY);
      return null;
    }

    if (!currentActiveSede) {
      // No hay sede activa, seleccionar la primera disponible
      const firstSede = sedes[0];
      setActiveSedeState(firstSede);
      localStorage.setItem(ACTIVE_SEDE_KEY, JSON.stringify(firstSede));
      return firstSede;
    }

    // Verificar si la sede activa sigue siendo válida
    const isValidSede = sedes.find(s => s.id === currentActiveSede.id);
    if (!isValidSede) {
      // La sede activa ya no es válida, cambiar a la primera disponible
      const firstSede = sedes[0];
      setActiveSedeState(firstSede);
      localStorage.setItem(ACTIVE_SEDE_KEY, JSON.stringify(firstSede));
      return firstSede;
    }

    return currentActiveSede;
  }, []);

  // Cargar sedes disponibles y sincronizar estado
  const refreshSedes = useCallback(async () => {
    try {
      setLoading(true);
      const sedes = await sedeStorageService.getUserAccessibleSedes();
      setAvailableSedes(sedes);

      // Obtener sede activa actual (desde estado o localStorage)
      const currentActiveSede = activeSede || restoreSedeFromStorage();
      
      // Si no hay sede activa pero hay sedes disponibles, seleccionar la primera automáticamente
      if (!currentActiveSede && sedes.length > 0) {
        const firstSede = sedes[0];
        setActiveSedeState(firstSede);
        localStorage.setItem(ACTIVE_SEDE_KEY, JSON.stringify(firstSede));
      } else {
        // Sincronizar sede activa con sedes disponibles
        syncActiveSede(sedes, currentActiveSede);
      }

    } catch (error) {
      console.error('🏢 SedeContext: Error loading sedes:', error);
      setAvailableSedes([]);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [activeSede, restoreSedeFromStorage, syncActiveSede]);

  // Inicializar contexto una sola vez cuando el usuario esté autenticado
  useEffect(() => {
    // Si la autenticación aún está cargando, esperar
    if (authLoading) {
      return;
    }
    
    // Si no hay usuario autenticado, marcar como inicializado sin cargar sedes
    if (!user) {
      setLoading(false);
      setIsInitialized(true);
      setActiveSedeState(null);
      setAvailableSedes([]);
      return;
    }
    
    // Si hay usuario autenticado y no se ha inicializado, cargar sedes
    if (!isInitialized) {
      refreshSedes();
    }
  }, [user, authLoading, isInitialized, loading]);

  const setActiveSede = useCallback((sede: Sede | null) => {
    // Verificar que sede no sea null
    if (!sede) {
      console.warn('⚠️ setActiveSede called with null sede');
      return;
    }
    
    const previousSedeId = activeSede?.id;
    
    // Solo proceder si es diferente
    if (previousSedeId === sede.id) {
      return;
    }
    
    // Actualizar estado y localStorage
    setActiveSedeState(sede);
    localStorage.setItem(ACTIVE_SEDE_KEY, JSON.stringify(sede));
    
    // Invalidar cache inteligentemente (sin refetch inmediato)
    const queriesToInvalidate = [
      ['tasks'],
      ['task-reports'], 
      ['cleaners'],
      ['properties'],
      ['clients'],
      ['recurring-tasks']
    ];
    
    queriesToInvalidate.forEach(queryKey => {
      queryClient.invalidateQueries({ queryKey });
    });

    // Log del cambio de sede para auditoría (no bloqueante)
    const logSedeChange = async () => {
      try {
        await supabase.rpc('log_sede_event', {
          event_type_param: 'sede_changed',
          from_sede_id_param: previousSedeId || null,
          to_sede_id_param: sede.id,
          event_data_param: {
            previous_sede_name: activeSede?.nombre || null,
            new_sede_name: sede.nombre,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Error logging sede change:', error);
      }
    };
    
    logSedeChange();
  }, [activeSede, queryClient]);

  const isActiveSedeSet = (): boolean => {
    return activeSede !== null;
  };

  const getActiveSedeId = (): string | null => {
    return activeSede?.id || null;
  };

  const hasAccessToSede = (sedeId: string): boolean => {
    return availableSedes.some(sede => sede.id === sedeId);
  };

  const value: SedeContextType = {
    activeSede,
    availableSedes,
    loading,
    isInitialized,
    setActiveSede,
    refreshSedes,
    isActiveSedeSet,
    getActiveSedeId,
    hasAccessToSede,
  };

  // Configurar contexto global cada vez que cambien los datos relevantes
  useEffect(() => {
    const getActiveSedeId = () => {
      if (!activeSede) {
        return null;
      }
      return activeSede.id;
    };

    const waitForActiveSede = async (timeout = 15000): Promise<string> => {
      return new Promise((resolve, reject) => {
        // Si ya hay sede activa, resolver inmediatamente
        if (activeSede?.id) {
          resolve(activeSede.id);
          return;
        }

        // Si hay sedes disponibles, auto-seleccionar la primera
        if (availableSedes.length > 0 && !activeSede) {
          const firstSede = availableSedes[0];
          setActiveSede(firstSede);
          resolve(firstSede.id);
          return;
        }

        // Si no hay sedes disponibles pero aún se está inicializando, esperar
        if (!isInitialized || loading) {
          const checkInterval = setInterval(() => {
            if (activeSede?.id) {
              clearInterval(checkInterval);
              resolve(activeSede.id);
            } else if (availableSedes.length > 0 && !activeSede) {
              clearInterval(checkInterval);
              const firstSede = availableSedes[0];
              setActiveSede(firstSede);
              resolve(firstSede.id);
            } else if (isInitialized && !loading && availableSedes.length === 0) {
              clearInterval(checkInterval);
              console.error('❌ waitForActiveSede - no sedes available after loading completed');
              reject(new Error('No hay sedes disponibles para el usuario'));
            }
          }, 200);

          setTimeout(() => {
            clearInterval(checkInterval);
            console.error('❌ waitForActiveSede - timeout');
            reject(new Error('Timeout esperando por sede activa'));
          }, timeout);
          
          return;
        }

        // Si ya se inicializó y no hay sedes disponibles
        console.error('❌ waitForActiveSede - no sedes available');
        reject(new Error('No hay sedes disponibles para el usuario'));
      });
    };

    // Configurar contexto global siempre, incluso si no está inicializado
    setGlobalSedeContext({
      getActiveSedeId,
      waitForActiveSede,
    });
  }, [activeSede, availableSedes, loading, isInitialized, setActiveSede]);

  return <SedeContext.Provider value={value}>{children}</SedeContext.Provider>;
};

export const useSede = () => {
  const context = useContext(SedeContext);
  
  if (context === undefined) {
    console.error('❌ useSede: Context is undefined. Make sure the component is wrapped in SedeProvider');
    throw new Error('useSede must be used within a SedeProvider');
  }
  return context;
};