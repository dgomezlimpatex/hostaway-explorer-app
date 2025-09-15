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
  console.log('🏗️ SedeProvider: Component mounting');
  
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const [activeSede, setActiveSedeState] = useState<Sede | null>(null);
  const [availableSedes, setAvailableSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  console.log('🏗️ SedeProvider: Current state:', {
    user: user ? { id: user.id, email: user.email } : 'null',
    authLoading,
    activeSede: activeSede?.nombre || 'null',
    availableSedesCount: availableSedes.length,
    loading,
    isInitialized
  });

  // Función para validar y restaurar sede desde localStorage
  const restoreSedeFromStorage = useCallback(() => {
    try {
      const savedSede = localStorage.getItem(ACTIVE_SEDE_KEY);
      if (savedSede) {
        const parsedSede = JSON.parse(savedSede) as Sede;
        setActiveSedeState(parsedSede);
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
      console.log('🏢 SedeContext: Refreshing sedes...');
      const sedes = await sedeStorageService.getUserAccessibleSedes();
      console.log('🏢 SedeContext: Available sedes loaded:', sedes.length, sedes.map(s => ({ id: s.id, nombre: s.nombre })));
      setAvailableSedes(sedes);

      // Obtener sede activa actual (desde estado o localStorage)
      const currentActiveSede = activeSede || restoreSedeFromStorage();
      console.log('🏢 SedeContext: Current active sede:', currentActiveSede?.nombre || 'ninguna');
      
      // Si no hay sede activa pero hay sedes disponibles, seleccionar la primera automáticamente
      if (!currentActiveSede && sedes.length > 0) {
        const firstSede = sedes[0];
        console.log('🎯 SedeContext: Auto-selecting first available sede:', firstSede.nombre);
        setActiveSedeState(firstSede);
        localStorage.setItem(ACTIVE_SEDE_KEY, JSON.stringify(firstSede));
      } else {
        // Sincronizar sede activa con sedes disponibles
        const finalActiveSede = syncActiveSede(sedes, currentActiveSede);
        console.log('🏢 SedeContext: Final active sede after sync:', finalActiveSede?.nombre || 'ninguna');
      }

    } catch (error) {
      console.error('🏢 SedeContext: Error loading sedes:', error);
      setAvailableSedes([]);
    } finally {
      setLoading(false);
      setIsInitialized(true);
      console.log('🏢 SedeContext: Refresh sedes completed. Loading:', false, 'Initialized:', true);
    }
  }, [activeSede, restoreSedeFromStorage, syncActiveSede]);

  // Inicializar contexto una sola vez cuando el usuario esté autenticado
  useEffect(() => {
    // Si la autenticación aún está cargando, esperar
    if (authLoading) {
      console.log('🏢 SedeContext: Auth still loading, waiting...');
      return;
    }
    
    // Si no hay usuario autenticado, marcar como inicializado sin cargar sedes
    if (!user) {
      console.log('🏢 SedeContext: No user authenticated, skipping sede loading');
      setLoading(false);
      setIsInitialized(true);
      setActiveSedeState(null);
      setAvailableSedes([]);
      return;
    }
    
    // Si hay usuario autenticado y no se ha inicializado, cargar sedes
    if (!isInitialized && !loading) {
      console.log('🏢 SedeContext: User authenticated, loading sedes...', { userId: user.id });
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

  console.log('🎯 SedeProvider: Providing context value:', {
    activeSede: value.activeSede?.nombre || 'null',
    availableSedesCount: value.availableSedes.length,
    loading: value.loading,
    isInitialized: value.isInitialized
  });

  // Configurar contexto global para BaseStorage una sola vez al inicializar
  useEffect(() => {
    if (!isInitialized) return;
    
    console.log('🔧 SedeProvider: Configurando contexto global', {
      activeSede: activeSede?.nombre || 'null',
      loading,
      isInitialized,
      availableSedesCount: availableSedes.length
    });

    const getActiveSedeId = () => {
      if (!activeSede) {
        console.log('🏢 Global Context getActiveSedeId: No active sede');
        return null;
      }
      console.log(`🏢 Global Context getActiveSedeId: ${activeSede.nombre}`);
      return activeSede.id;
    };

    const waitForActiveSede = async (timeout = 3000): Promise<string> => {
      return new Promise((resolve, reject) => {
        console.log('⏳ waitForActiveSede started');

        // Si ya hay sede activa, resolver inmediatamente
        if (activeSede?.id) {
          console.log('✅ waitForActiveSede - found immediately:', activeSede.nombre);
          resolve(activeSede.id);
          return;
        }

        // Si hay sedes disponibles, auto-seleccionar la primera
        if (availableSedes.length > 0) {
          const firstSede = availableSedes[0];
          console.log('🎯 waitForActiveSede - auto-selecting:', firstSede.nombre);
          setActiveSede(firstSede);
          resolve(firstSede.id);
          return;
        }

        // Si no hay sedes disponibles
        console.error('❌ waitForActiveSede - no sedes available');
        reject(new Error('No hay sedes disponibles para el usuario'));
      });
    };

    // Configurar contexto global
    setGlobalSedeContext({
      getActiveSedeId,
      waitForActiveSede,
    });
  }, [isInitialized, activeSede, availableSedes, setActiveSede]);

  return <SedeContext.Provider value={value}>{children}</SedeContext.Provider>;
};

export const useSede = () => {
  const context = useContext(SedeContext);
  console.log('🔍 useSede called - context status:', {
    contextExists: !!context,
    contextValues: context ? {
      activeSede: context.activeSede?.nombre || 'null',
      availableSedesCount: context.availableSedes?.length || 0,
      loading: context.loading,
      isInitialized: context.isInitialized
    } : 'CONTEXT_IS_UNDEFINED'
  });
  
  if (context === undefined) {
    console.error('❌ useSede: Context is undefined. Make sure the component is wrapped in SedeProvider');
    console.error('❌ Call stack:', new Error().stack);
    throw new Error('useSede must be used within a SedeProvider');
  }
  return context;
};