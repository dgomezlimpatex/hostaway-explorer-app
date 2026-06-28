import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sede, SedeContextType } from '@/types/sede';
import { sedeStorageService } from '@/services/storage/sedeStorage';
import { useAuth } from '@/hooks/useAuth';
import { setGlobalSedeContext } from '@/services/storage/baseStorage';

const SedeContext = createContext<SedeContextType | undefined>(undefined);

const ACTIVE_SEDE_KEY = 'activeSede';

const normalizeSedeText = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const isCorunaSede = (sede: Sede) => {
  const searchableText = [sede.nombre, sede.codigo, sede.ciudad].map(normalizeSedeText).join(' ');
  return searchableText.includes('a coruna') || searchableText.includes('coruna');
};

const selectPreferredSede = (sedes: Sede[], savedSede: Sede | null): Sede | null => {
  if (sedes.length === 0) return null;
  if (savedSede?.id) {
    const validSavedSede = sedes.find((sede) => sede.id === savedSede.id);
    if (validSavedSede) return validSavedSede;
  }
  return sedes.find(isCorunaSede) || sedes[0];
};

const persistActiveSede = (sede: Sede | null) => {
  if (sede) {
    localStorage.setItem(ACTIVE_SEDE_KEY, JSON.stringify(sede));
  } else {
    localStorage.removeItem(ACTIVE_SEDE_KEY);
  }
};

interface SedeProviderProps {
  children: ReactNode;
}

export const SedeProvider = ({ children }: SedeProviderProps) => {
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const [activeSede, setActiveSedeState] = useState<Sede | null>(null);
  const [availableSedes, setAvailableSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const hasStartedInitialLoad = useRef(false);

  // Leer la sede guardada sin activarla hasta validarla contra sedes accesibles
  const getSavedSedeFromStorage = useCallback(() => {
    try {
      const savedSede = localStorage.getItem(ACTIVE_SEDE_KEY);
      if (savedSede) return JSON.parse(savedSede) as Sede;
    } catch (error) {
      console.error('Error parsing saved sede:', error);
      persistActiveSede(null);
    }
    return null;
  }, []);

  const invalidateSedeScopedQueries = useCallback(() => {
    const queriesToInvalidate = [
      ['tasks'],
      ['task-reports'],
      ['cleaners'],
      ['properties'],
      ['clients'],
      ['recurring-tasks'],
      ['recurring-tasks-for-calendar'],
    ];
    queriesToInvalidate.forEach(queryKey => queryClient.invalidateQueries({ queryKey }));
  }, [queryClient]);

  // Sincronizar sede activa con sedes disponibles, prefiriendo guardada válida y luego A Coruña
  const syncActiveSede = useCallback((sedes: Sede[], currentActiveSede: Sede | null) => {
    if (sedes.length === 0) {
      setActiveSedeState(null);
      persistActiveSede(null);
      return null;
    }

    const preferredSede = selectPreferredSede(sedes, currentActiveSede);
    if (preferredSede && preferredSede.id !== currentActiveSede?.id) {
      setActiveSedeState(preferredSede);
      persistActiveSede(preferredSede);
      invalidateSedeScopedQueries();
      return preferredSede;
    }

    if (preferredSede) {
      setActiveSedeState(preferredSede);
      persistActiveSede(preferredSede);
    }
    return preferredSede;
  }, [invalidateSedeScopedQueries]);

  // Cargar sedes disponibles y sincronizar estado
  const refreshSedes = useCallback(async () => {
    try {
      setLoading(true);
      const sedes = await sedeStorageService.getUserAccessibleSedes();
      setAvailableSedes(sedes);

      // Obtener sede activa actual (desde estado o localStorage)
      const currentActiveSede = activeSede || getSavedSedeFromStorage();
      
      syncActiveSede(sedes, currentActiveSede);

    } catch (error) {
      console.error('🏢 SedeContext: Error loading sedes:', error);
      setAvailableSedes([]);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [activeSede, getSavedSedeFromStorage, syncActiveSede]);

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
      hasStartedInitialLoad.current = false;
      return;
    }
    
    // Si hay usuario autenticado y no se ha inicializado, cargar sedes
    if (!isInitialized && !hasStartedInitialLoad.current) {
      hasStartedInitialLoad.current = true;
      refreshSedes();
    }
  }, [user, authLoading, isInitialized, refreshSedes]);

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
    persistActiveSede(sede);
    
    // Invalidar cache inteligentemente (sin refetch inmediato)
    invalidateSedeScopedQueries();

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
  }, [activeSede, invalidateSedeScopedQueries]);

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

        // Si hay sedes disponibles, auto-seleccionar la preferida
        if (availableSedes.length > 0 && !activeSede) {
          const preferredSede = selectPreferredSede(availableSedes, getSavedSedeFromStorage());
          if (preferredSede) {
            setActiveSede(preferredSede);
            resolve(preferredSede.id);
          }
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
              const preferredSede = selectPreferredSede(availableSedes, getSavedSedeFromStorage());
              if (preferredSede) {
                setActiveSede(preferredSede);
                resolve(preferredSede.id);
              }
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
  }, [activeSede, availableSedes, loading, isInitialized, setActiveSede, getSavedSedeFromStorage]);

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