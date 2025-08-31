
import { CleanerAvailability } from '@/hooks/useCleanerAvailability';

export const isCleanerAvailableAtTime = (
  cleanerId: string,
  date: Date,
  startTime: string,
  endTime: string,
  availability: CleanerAvailability[]
): { available: boolean; reason?: string } => {
  const dayOfWeek = date.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
  
  // Removed excessive availability check logging
  
  // Buscar la disponibilidad para este trabajador en este día
  const dayAvailability = availability.find(
    avail => avail.cleaner_id === cleanerId && avail.day_of_week === dayOfWeek
  );

  // Removed excessive availability record logging

  // Si no hay configuración para este día, asumimos que NO está disponible por defecto
  if (!dayAvailability) {
    console.log('❌ No availability configuration found for this day');
    return { 
      available: false, 
      reason: 'Sin configuración de disponibilidad para este día' 
    };
  }

  // Si está marcado como no disponible
  if (!dayAvailability.is_available) {
    return { 
      available: false, 
      reason: 'No disponible este día' 
    };
  }

  // Verificar si el horario de la tarea está dentro del horario disponible
  const availableStart = dayAvailability.start_time;
  const availableEnd = dayAvailability.end_time;

  if (!availableStart || !availableEnd) {
    return { 
      available: false, 
      reason: 'Horarios no configurados' 
    };
  }

  const taskStart = timeToMinutes(startTime);
  const taskEnd = timeToMinutes(endTime);
  const availStart = timeToMinutes(availableStart);
  const availEnd = timeToMinutes(availableEnd);

  // Removed excessive time comparison logging

  if (taskStart < availStart || taskEnd > availEnd) {
    return { 
      available: false, 
      reason: `Disponible solo de ${availableStart} a ${availableEnd}` 
    };
  }

  return { available: true };
};

export const timeToMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

export const getCleanerAvailabilityForDay = (
  cleanerId: string,
  date: Date,
  availability: CleanerAvailability[]
): CleanerAvailability | null => {
  const dayOfWeek = date.getDay();
  return availability.find(
    avail => avail.cleaner_id === cleanerId && avail.day_of_week === dayOfWeek
  ) || null;
};
