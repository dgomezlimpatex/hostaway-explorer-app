
import { CleanerAvailability } from '@/hooks/useCleanerAvailability';

export const isCleanerAvailableAtTime = (
  cleanerId: string,
  date: Date,
  startTime: string,
  endTime: string,
  availability: CleanerAvailability[]
): { available: boolean; reason?: string } => {
  const dayOfWeek = date.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
  
  // Buscar la disponibilidad para este trabajador en este día
  const dayAvailability = availability.find(
    avail => avail.cleaner_id === cleanerId && avail.day_of_week === dayOfWeek
  );

  // Si no hay configuración para este día, asumimos que está disponible
  if (!dayAvailability) {
    return { available: true };
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
    return { available: true };
  }

  const taskStart = timeToMinutes(startTime);
  const taskEnd = timeToMinutes(endTime);
  const availStart = timeToMinutes(availableStart);
  const availEnd = timeToMinutes(availableEnd);

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
