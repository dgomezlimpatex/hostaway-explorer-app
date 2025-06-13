
export interface Task {
  id: string;
  property: string;
  address: string;
  startTime: string;
  endTime: string;
  type: string;
  status: 'pending' | 'in-progress' | 'completed';
  checkOut: string;
  checkIn: string;
  cleaner?: string;
  backgroundColor?: string;
  date: string;
  // Nuevos campos para vinculación
  clienteId?: string;
  propiedadId?: string;
  propertyCode?: string; // Adding the property code field
  duracion?: number; // en minutos
  coste?: number; // en euros
  metodoPago?: string;
  supervisor?: string;
  cleanerId?: string; // ID del limpiador asignado
}

export interface Cleaner {
  id: string;
  name: string;
  email?: string;
  telefono?: string;
  avatar?: string;
  isActive: boolean;
  sortOrder?: number; // Campo para el orden manual
}

export type ViewType = 'day' | 'three-day' | 'week';
