import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Sede, SedeContextType } from '@/types/sede';
import { sedeStorageService } from '@/services/storage/sedeStorage';

const SedeContext = createContext<SedeContextType | undefined>(undefined);

const ACTIVE_SEDE_KEY = 'activeSede';

interface SedeProviderProps {
  children: ReactNode;
}

export const SedeProvider = ({ children }: SedeProviderProps) => {
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

  const setActiveSede = (sede: Sede) => {
    setActiveSedeState(sede);
    localStorage.setItem(ACTIVE_SEDE_KEY, JSON.stringify(sede));
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