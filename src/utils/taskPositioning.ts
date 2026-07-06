
// Helper function to convert time string to minutes
const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (mins: number) => {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const getTaskAssignedCount = (task: any, assignmentsMap?: Record<string, string[]>): number => {
  if (typeof task.assignmentCount === 'number' && task.assignmentCount > 0) return task.assignmentCount;
  const assignmentIds = assignmentsMap?.[task.id];
  if (Array.isArray(assignmentIds) && assignmentIds.length > 0) return assignmentIds.length;
  if (Array.isArray(task.assignments) && task.assignments.length > 0) return task.assignments.length;
  if (typeof task.cleaner === 'string' && task.cleaner.includes(',')) {
    return task.cleaner.split(',').map((name: string) => name.trim()).filter(Boolean).length;
  }
  return 1;
};

const isTaskAssignedToCleaner = (task: any, cleanerId: string, cleanerName?: string, assignmentsMap?: Record<string, string[]>): boolean => {
  const normalizedCleanerName = cleanerName?.trim().toLocaleUpperCase('es-ES');

  return task.cleanerId === cleanerId ||
    (normalizedCleanerName && task.cleaner?.trim().toLocaleUpperCase('es-ES') === normalizedCleanerName) ||
    (typeof task.cleaner === 'string' && task.cleaner.includes(',') &&
      task.cleaner
        .split(',')
        .some((name: string) => name.trim().toLocaleUpperCase('es-ES') === normalizedCleanerName)) ||
    (Array.isArray(assignmentsMap?.[task.id]) && assignmentsMap![task.id].includes(cleanerId));
};

export const getEffectiveTaskEndTime = (task: any, assignmentsMap?: Record<string, string[]>): string => {
  // For multi-worker tasks every worker actually works only a fraction of the
  // total scheduled window (all in parallel, same start). The visible block on
  // the calendar — and the slots considered "occupied" — should reflect that
  // shorter per-worker duration, not the full window.
  const count = getTaskAssignedCount(task, assignmentsMap);
  if (count <= 1) return task.endTime;

  const startMin = timeToMinutes(task.startTime);
  let endMin = timeToMinutes(task.endTime);
  if (endMin <= startMin) endMin += 24 * 60; // crosses midnight
  const totalMin = Math.max(0, endMin - startMin);
  const perWorker = Math.max(15, Math.round(totalMin / count));
  const newEnd = (startMin + perWorker) % (24 * 60);
  return minutesToTime(newEnd);
};

export const getEffectiveTaskDurationMinutes = (task: any, assignmentsMap?: Record<string, string[]>): number => {
  const startMin = timeToMinutes(task.startTime);
  let endMin = timeToMinutes(getEffectiveTaskEndTime(task, assignmentsMap));
  if (endMin <= startMin) endMin += 24 * 60;
  return Math.max(0, endMin - startMin);
};


// Detect overlapping tasks for a specific cleaner
export const detectTaskOverlaps = (
  cleanerId: string,
  newTaskStartTime: string,
  newTaskEndTime: string,
  existingTasks: any[],
  cleaners: any[],
  excludeTaskId?: string,
  assignmentsMap?: Record<string, string[]>,
  useEffectiveEndTime = true
) => {
  const cleanerName = cleaners.find(c => c.id === cleanerId)?.name;
  const newStartMinutes = timeToMinutes(newTaskStartTime);
  const newEndMinutes = timeToMinutes(newTaskEndTime);
  
  const overlappingTasks = existingTasks.filter(task => {
    // Skip the task being moved/edited
    if (excludeTaskId && task.id === excludeTaskId) {
      return false;
    }
    
    // Only check tasks assigned to the same cleaner, including multi-worker assignments
    if (!isTaskAssignedToCleaner(task, cleanerId, cleanerName, assignmentsMap)) {
      return false;
    }
    
    const taskStartMinutes = timeToMinutes(task.startTime);
    const taskEndMinutes = timeToMinutes(useEffectiveEndTime ? getEffectiveTaskEndTime(task, assignmentsMap) : task.endTime);
    
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
  cleaners: any[],
  assignmentsMap?: Record<string, string[]>
) => {
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  // Each time slot is now 50px wide and represents 30 minutes
  const slotWidth = 50;
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
    task.id,
    assignmentsMap,
    false
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
    width: `${Math.max(widthPixels, 80)}px`,
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
  
  // Each time slot is now 50px wide and represents 30 minutes
  const slotWidth = 50; // pixels (reduced from 60px)
  const minutesPerSlot = 30; // minutes
  const dayStartMinutes = 6 * 60; // 6:00 AM
  
  // Calculate position based on slots from day start
  const slotsFromStart = (startMinutes - dayStartMinutes) / minutesPerSlot;
  const durationInSlots = (endMinutes - startMinutes) / minutesPerSlot;
  
  const leftPixels = slotsFromStart * slotWidth;
  const widthPixels = durationInSlots * slotWidth;
  
  return { 
    left: `${leftPixels}px`, 
    width: `${Math.max(widthPixels, 80)}px` // Minimum width of 80px (reduced from 100px)
  };
};

export const isTimeSlotOccupied = (
  cleanerId: string, 
  hour: number, 
  minute: number, 
  assignedTasks: any[], 
  cleaners: any[],
  excludeTaskId?: string, // Parámetro para excluir la tarea que se está arrastrando
  assignmentsMap?: Record<string, string[]>
) => {
  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const cleanerName = cleaners.find(c => c.id === cleanerId)?.name;
  
  return assignedTasks.some(task => {
    // Excluir completamente la tarea que se está arrastrando del cálculo
    if (excludeTaskId && task.id === excludeTaskId) {
      return false;
    }
    
    const taskStartMinutes = timeToMinutes(task.startTime);
    const taskEndMinutes = timeToMinutes(getEffectiveTaskEndTime(task, assignmentsMap));
    const slotMinutes = timeToMinutes(timeString);
    
    // Un slot está ocupado si la tarea cubre este intervalo de tiempo
    // y pertenece al mismo limpiador
    const assignedToCleaner = isTaskAssignedToCleaner(task, cleanerId, cleanerName, assignmentsMap);

    return assignedToCleaner &&
           slotMinutes >= taskStartMinutes && 
           slotMinutes < taskEndMinutes;
  });
};

