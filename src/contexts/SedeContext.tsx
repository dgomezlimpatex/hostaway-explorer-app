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
  const loadedUserIdRef = useRef<string | null>(null);
  const latestSedeStateRef = useRef({
    activeSede: null as Sede | null,
    availableSedes: [] as Sede[],
    loading: true,
    isInitialized: false,
  });

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
    if (!preferredSede) return null;

    setActiveSedeState(preferredSede);
    persistActiveSede(preferredSede);

    if (preferredSede.id !== currentActiveSede?.id) {
      invalidateSedeScopedQueries();
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

  // Inicializar contexto cada vez que cambia el usuario autenticado.
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setLoading(false);
      setIsInitialized(true);
      setActiveSedeState(null);
      setAvailableSedes([]);
      loadedUserIdRef.current = null;
      return;
    }

    if (loadedUserIdRef.current !== user.id) {
      loadedUserIdRef.current = user.id;
      setIsInitialized(false);
      refreshSedes();
    }
  }, [user, authLoading, refreshSedes]);

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

  // Mantener una referencia viva para callbacks/polling que no deben quedarse con closures antiguas.
  useEffect(() => {
    latestSedeStateRef.current = {
      activeSede,
      availableSedes,
      loading,
      isInitialized,
    };
  }, [activeSede, availableSedes, loading, isInitialized]);

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
      const current = latestSedeStateRef.current.activeSede;
      return current?.id || null;
    };

    const waitForActiveSede = async (timeout = 15000): Promise<string> => {
      return new Promise((resolve, reject) => {
        const resolveCurrentOrPreferred = () => {
          const currentState = latestSedeStateRef.current;

          if (currentState.activeSede?.id) {
            resolve(currentState.activeSede.id);
            return true;
          }

          if (currentState.availableSedes.length > 0) {
            const preferredSede = selectPreferredSede(currentState.availableSedes, getSavedSedeFromStorage());
            if (preferredSede) {
              setActiveSede(preferredSede);
              resolve(preferredSede.id);
              return true;
            }
          }

          if (currentState.isInitialized && !currentState.loading && currentState.availableSedes.length === 0) {
            reject(new Error('No hay sedes disponibles para el usuario'));
            return true;
          }

          return false;
        };

        if (resolveCurrentOrPreferred()) {
          return;
        }

        const checkInterval = setInterval(() => {
          if (resolveCurrentOrPreferred()) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
          }
        }, 200);

        const timeoutId = setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Timeout esperando por sede activa'));
        }, timeout);
      });
    };

    setGlobalSedeContext({
      getActiveSedeId,
      waitForActiveSede,
    });
  }, [setActiveSede, getSavedSedeFromStorage]);

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