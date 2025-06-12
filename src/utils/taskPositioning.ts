
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

export const isTimeSlotOccupied = (
  cleanerId: string, 
  hour: number, 
  minute: number, 
  assignedTasks: any[], 
  cleaners: any[]
) => {
  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const cleanerName = cleaners.find(c => c.id === cleanerId)?.name;
  
  // Don't consider a time slot occupied by the task that's currently being dragged
  return assignedTasks.some(task => {
    const taskStartMinutes = timeToMinutes(task.startTime);
    const taskEndMinutes = timeToMinutes(task.endTime);
    const slotMinutes = timeToMinutes(timeString);
    
    // A slot is occupied if the task covers this time slot
    // But we need to allow dropping within the same task's time range
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
