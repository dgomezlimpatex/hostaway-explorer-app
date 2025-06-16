
export const getTaskPosition = (startTime: string, endTime: string) => {
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

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

// Nueva función para detectar colisiones entre tareas
export const detectTaskCollisions = (tasks: any[], cleanerId: string) => {
  const cleanerTasks = tasks.filter(task => task.cleanerId === cleanerId || task.cleaner === cleanerId);
  const collisionGroups: any[][] = [];
  
  cleanerTasks.forEach(task => {
    const taskStart = timeToMinutes(task.startTime);
    const taskEnd = timeToMinutes(task.endTime);
    
    // Buscar si esta tarea colisiona con algún grupo existente
    let addedToGroup = false;
    for (let group of collisionGroups) {
      const hasCollision = group.some(groupTask => {
        const groupStart = timeToMinutes(groupTask.startTime);
        const groupEnd = timeToMinutes(groupTask.endTime);
        
        // Verificar si hay solapamiento
        return (taskStart < groupEnd && taskEnd > groupStart);
      });
      
      if (hasCollision) {
        group.push(task);
        addedToGroup = true;
        break;
      }
    }
    
    // Si no colisiona con ningún grupo, crear uno nuevo
    if (!addedToGroup) {
      collisionGroups.push([task]);
    }
  });
  
  return collisionGroups;
};

// Nueva función para calcular posición con manejo de colisiones
export const getTaskPositionWithCollisions = (
  task: any, 
  allTasks: any[], 
  cleanerId: string
) => {
  const basePosition = getTaskPosition(task.startTime, task.endTime);
  const collisionGroups = detectTaskCollisions(allTasks, cleanerId);
  
  // Encontrar el grupo de colisión de esta tarea
  const taskGroup = collisionGroups.find(group => 
    group.some(t => t.id === task.id)
  );
  
  if (!taskGroup || taskGroup.length === 1) {
    return {
      ...basePosition,
      top: '2px',
      height: 'calc(100% - 4px)',
      zIndex: 10
    };
  }
  
  // Si hay colisiones, dividir el espacio verticalmente
  const taskIndex = taskGroup.findIndex(t => t.id === task.id);
  const totalTasks = taskGroup.length;
  const heightPerTask = Math.floor((100 - 8) / totalTasks); // 8px de margen total
  
  return {
    ...basePosition,
    top: `${2 + (taskIndex * heightPerTask)}%`,
    height: `${heightPerTask - 2}%`,
    zIndex: 10 + taskIndex
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

// Helper function to convert time string to minutes
const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};
