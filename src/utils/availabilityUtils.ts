
import { CleanerAvailability } from '@/hooks/useCleanerAvailability';

export const isCleanerAvailableAtTime = (
  cleanerId: string,
  date: Date,
  startTime: string,
  endTime: string,
  availability: CleanerAvailability[]
): { available: boolean; reason?: string } => {
  const dayOfWeek = date.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
  
  console.log('🔍 isCleanerAvailableAtTime called with:', {
    cleanerId,
    date: date.toISOString(),
    dayOfWeek,
    startTime,
    endTime,
    availabilityRecords: availability.length
  });
  
  // Buscar la disponibilidad para este trabajador en este día
  const dayAvailability = availability.find(
    avail => avail.cleaner_id === cleanerId && avail.day_of_week === dayOfWeek
  );

  console.log('📅 Found availability record:', dayAvailability);

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
    console.log('❌ Marked as not available');
    return { 
      available: false, 
      reason: 'No disponible este día' 
    };
  }

  // Verificar si el horario de la tarea está dentro del horario disponible
  const availableStart = dayAvailability.start_time;
  const availableEnd = dayAvailability.end_time;

  if (!availableStart || !availableEnd) {
    console.log('❌ No start/end time configured');
    return { 
      available: false, 
      reason: 'Horarios no configurados' 
    };
  }

  const taskStart = timeToMinutes(startTime);
  const taskEnd = timeToMinutes(endTime);
  const availStart = timeToMinutes(availableStart);
  const availEnd = timeToMinutes(availableEnd);

  console.log('⏰ Time comparison:', {
    taskStart,
    taskEnd,
    availStart,
    availEnd,
    taskStartOk: taskStart >= availStart,
    taskEndOk: taskEnd <= availEnd
  });

  if (taskStart < availStart || taskEnd > availEnd) {
    console.log('❌ Outside available hours');
    return { 
      available: false, 
      reason: `Disponible solo de ${availableStart} a ${availableEnd}` 
    };
  }

  console.log('✅ Available');
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
