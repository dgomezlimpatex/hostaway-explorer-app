export interface Sede {
  id: string;
  nombre: string;
  codigo: string;
  ciudad: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSedeData {
  nombre: string;
  codigo: string;
  ciudad: string;
  direccion?: string;
  telefono?: string;
  email?: string;
}

export interface UserSedeAccess {
  id: string;
  user_id: string;
  sede_id: string;
  can_access: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserSedeAccessData {
  user_id: string;
  sede_id: string;
  can_access?: boolean;
}

export interface SedeContextType {
  // Estado actual
  activeSede: Sede | null;
  availableSedes: Sede[];
  loading: boolean;
  isInitialized?: boolean;
  
  // Acciones
  setActiveSede: (sede: Sede) => void;
  refreshSedes: () => Promise<void>;
  
  // Helpers
  isActiveSedeSet: () => boolean;
  getActiveSedeId: () => string | null;
  hasAccessToSede: (sedeId: string) => boolean;
}

export interface SedeFilterOptions {
  includeInactive?: boolean;
  userAccessOnly?: boolean;
}