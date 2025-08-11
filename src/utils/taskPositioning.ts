
// Helper function to convert time string to minutes
const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Detect overlapping tasks for a specific cleaner
export const detectTaskOverlaps = (
  cleanerId: string,
  newTaskStartTime: string,
  newTaskEndTime: string,
  existingTasks: any[],
  cleaners: any[],
  excludeTaskId?: string
) => {
  const cleanerName = cleaners.find(c => c.id === cleanerId)?.name;
  const newStartMinutes = timeToMinutes(newTaskStartTime);
  const newEndMinutes = timeToMinutes(newTaskEndTime);
  
  const overlappingTasks = existingTasks.filter(task => {
    // Skip the task being moved/edited
    if (excludeTaskId && task.id === excludeTaskId) {
      return false;
    }
    
    // Only check tasks for the same cleaner
    if (task.cleaner !== cleanerName && task.cleanerId !== cleanerId) {
      return false;
    }
    
    const taskStartMinutes = timeToMinutes(task.startTime);
    const taskEndMinutes = timeToMinutes(task.endTime);
    
    // Check for overlap: tasks overlap if start of one is before end of other
    return (newStartMinutes < taskEndMinutes) && (newEndMinutes > taskStartMinutes);
  });
  
  return overlappingTasks;
};

// Calculate positioning with overlap detection
export const getTaskPositionWithOverlap = (
  startTime: string, 
  endTime: string,
  task: any,
  allTasks: any[],
  cleanerId: string,
  cleaners: any[]
) => {
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  // Each time slot is now 60px wide and represents 30 minutes
  const slotWidth = 60;
  const minutesPerSlot = 30;
  const dayStartMinutes = 6 * 60; // 6:00 AM
  
  // Calculate position based on slots from day start
  const slotsFromStart = (startMinutes - dayStartMinutes) / minutesPerSlot;
  const durationInSlots = (endMinutes - startMinutes) / minutesPerSlot;
  
  const leftPixels = slotsFromStart * slotWidth;
  const widthPixels = durationInSlots * slotWidth;
  
  // Check for overlaps
  const overlappingTasks = detectTaskOverlaps(
    cleanerId,
    startTime,
    endTime,
    allTasks,
    cleaners,
    task.id
  );
  
  // If there are overlaps, calculate stacking position
  let topOffset = 0;
  let heightAdjustment = 1;
  
  if (overlappingTasks.length > 0) {
    // Find the index of this task among overlapping tasks (for consistent positioning)
    const allOverlappingTasks = [task, ...overlappingTasks].sort((a, b) => {
      const aStart = timeToMinutes(a.startTime);
      const bStart = timeToMinutes(b.startTime);
      return aStart - bStart || a.id.localeCompare(b.id); // Sort by start time, then by ID for consistency
    });
    
    const taskIndex = allOverlappingTasks.findIndex(t => t.id === task.id);
    const totalOverlapping = allOverlappingTasks.length;
    
    // Adjust height and position for stacking
    heightAdjustment = 1 / totalOverlapping;
    topOffset = (taskIndex * 100) / totalOverlapping;
  }
  
  return { 
    left: `${leftPixels}px`, 
    width: `${Math.max(widthPixels, 100)}px`,
    top: `${topOffset}%`,
    height: `${heightAdjustment * 100}%`,
    hasOverlap: overlappingTasks.length > 0,
    overlapCount: overlappingTasks.length,
    zIndex: overlappingTasks.length > 0 ? 20 : 10
  };
};

export const getTaskPosition = (startTime: string, endTime: string) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  // Each time slot is now 60px wide and represents 30 minutes
  const slotWidth = 60; // pixels (reduced from 75px)
  const minutesPerSlot = 30; // minutes
  const dayStartMinutes = 6 * 60; // 6:00 AM
  
  // Calculate position based on slots from day start
  const slotsFromStart = (startMinutes - dayStartMinutes) / minutesPerSlot;
  const durationInSlots = (endMinutes - startMinutes) / minutesPerSlot;
  
  const leftPixels = slotsFromStart * slotWidth;
  const widthPixels = durationInSlots * slotWidth;
  
  return { 
    left: `${leftPixels}px`, 
    width: `${Math.max(widthPixels, 100)}px` // Minimum width of 100px (reduced from 120px)
  };
};

export const isTimeSlotOccupied = (
  cleanerId: string, 
  hour: number, 
  minute: number, 
  assignedTasks: any[], 
  cleaners: any[],
  excludeTaskId?: string // Parámetro para excluir la tarea que se está arrastrando
) => {
  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const cleanerName = cleaners.find(c => c.id === cleanerId)?.name;
  
  return assignedTasks.some(task => {
    // Excluir completamente la tarea que se está arrastrando del cálculo
    if (excludeTaskId && task.id === excludeTaskId) {
      return false;
    }
    
    const taskStartMinutes = timeToMinutes(task.startTime);
    const taskEndMinutes = timeToMinutes(task.endTime);
    const slotMinutes = timeToMinutes(timeString);
    
    // Un slot está ocupado si la tarea cubre este intervalo de tiempo
    // y pertenece al mismo limpiador
    return task.cleaner === cleanerName &&
           slotMinutes >= taskStartMinutes && 
           slotMinutes < taskEndMinutes;
  });
};

