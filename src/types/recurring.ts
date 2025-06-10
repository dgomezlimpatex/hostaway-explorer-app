
export interface RecurringTask {
  id: string;
  name: string;
  description?: string;
  clienteId?: string;
  propiedadId?: string;
  type: string;
  startTime: string;
  endTime: string;
  checkOut: string;
  checkIn: string;
  duracion?: number;
  coste?: number;
  metodoPago?: string;
  supervisor?: string;
  cleaner?: string;
  
  // Configuración de recurrencia
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number; // cada cuántos días/semanas/meses
  daysOfWeek?: number[]; // para frecuencia semanal: 0=domingo, 1=lunes, etc.
  dayOfMonth?: number; // para frecuencia mensual
  startDate: string;
  endDate?: string; // opcional, si no se especifica es indefinido
  
  // Estado
  isActive: boolean;
  nextExecution: string;
  lastExecution?: string;
  createdAt: string;
}
