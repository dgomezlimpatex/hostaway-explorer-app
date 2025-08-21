import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sede, SedeContextType } from '@/types/sede';
import { sedeStorageService } from '@/services/storage/sedeStorage';

const SedeContext = createContext<SedeContextType | undefined>(undefined);

const ACTIVE_SEDE_KEY = 'activeSede';

interface SedeProviderProps {
  children: ReactNode;
}

export const SedeProvider = ({ children }: SedeProviderProps) => {
  const queryClient = useQueryClient();
  const [activeSede, setActiveSedeState] = useState<Sede | null>(null);
  const [availableSedes, setAvailableSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar sede activa desde localStorage al inicializar
  useEffect(() => {
    const savedSede = localStorage.getItem(ACTIVE_SEDE_KEY);
    if (savedSede) {
      try {
        const parsedSede = JSON.parse(savedSede) as Sede;
        setActiveSedeState(parsedSede);
      } catch (error) {
        console.error('Error parsing saved sede:', error);
        localStorage.removeItem(ACTIVE_SEDE_KEY);
      }
    }
  }, []);

  // Cargar sedes disponibles
  const refreshSedes = async () => {
    try {
      setLoading(true);
      const sedes = await sedeStorageService.getUserAccessibleSedes();
      setAvailableSedes(sedes);

      // Si no hay sede activa pero hay sedes disponibles, seleccionar la primera
      if (!activeSede && sedes.length > 0) {
        const firstSede = sedes[0];
        setActiveSede(firstSede);
      }

      // Si la sede activa ya no está disponible, cambiar a la primera disponible
      if (activeSede && !sedes.find(s => s.id === activeSede.id) && sedes.length > 0) {
        setActiveSede(sedes[0]);
      }

      // Si no hay sedes disponibles, limpiar la sede activa
      if (sedes.length === 0) {
        setActiveSedeState(null);
        localStorage.removeItem(ACTIVE_SEDE_KEY);
      }
    } catch (error) {
      console.error('Error loading sedes:', error);
      setAvailableSedes([]);
    } finally {
      setLoading(false);
    }
  };

  // Cargar sedes al inicializar el contexto
  useEffect(() => {
    refreshSedes();
  }, []);

  const setActiveSede = async (sede: Sede) => {
    const previousSede = activeSede;
    const previousSedeId = activeSede?.id;
    
    setActiveSedeState(sede);
    localStorage.setItem(ACTIVE_SEDE_KEY, JSON.stringify(sede));
    
    // Log del cambio de sede para auditoría (solo si realmente cambió)
    if (previousSedeId !== sede.id) {
      try {
        await supabase.rpc('log_sede_event', {
          event_type_param: 'sede_changed',
          from_sede_id_param: previousSedeId || null,
          to_sede_id_param: sede.id,
          event_data_param: {
            previous_sede_name: previousSede?.nombre || null,
            new_sede_name: sede.nombre,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Error logging sede change:', error);
        // No bloqueamos la operación por falla en el log
      }

      // Invalidate all queries when sede changes
      queryClient.invalidateQueries();
    }
  };

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
    setActiveSede,
    refreshSedes,
    isActiveSedeSet,
    getActiveSedeId,
    hasAccessToSede,
  };

  return <SedeContext.Provider value={value}>{children}</SedeContext.Provider>;
};

export const useSede = () => {
  const context = useContext(SedeContext);
  if (context === undefined) {
    throw new Error('useSede must be used within a SedeProvider');
  }
  return context;
};