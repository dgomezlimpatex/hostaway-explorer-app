import { useMemo } from 'react';
import { 
  WorkerAbsence, 
  WorkerFixedDayOff, 
  WorkerMaintenanceCleaning,
  WorkerConflict,
  WorkerAvailabilityResult,
  ABSENCE_TYPE_CONFIG
} from '@/types/workerAbsence';

// Helper to check if two time ranges overlap
const timeRangesOverlap = (
  start1: string, 
  end1: string, 
  start2: string, 
  end2: string
): boolean => {
  // Convert to minutes for easier comparison
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  
  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);
  
  return s1 < e2 && e1 > s2;
};

// Format time for display
const formatTimeRange = (start: string, end: string): string => {
  const formatTime = (time: string) => time.slice(0, 5);
  return `${formatTime(start)} - ${formatTime(end)}`;
};

// Check worker availability for a specific date and time range
export const checkWorkerConflicts = (
  date: Date,
  taskStartTime: string,
  taskEndTime: string,
  absences: WorkerAbsence[],
  fixedDaysOff: WorkerFixedDayOff[],
  maintenanceCleanings: WorkerMaintenanceCleaning[]
): WorkerAvailabilityResult => {
  const conflicts: WorkerConflict[] = [];
  const dayOfWeek = date.getDay();
  const dateStr = date.toISOString().split('T')[0];

  // 1. Check fixed day off
  const fixedDayOff = fixedDaysOff.find(d => d.dayOfWeek === dayOfWeek && d.isActive);
  if (fixedDayOff) {
    conflicts.push({
      type: 'fixed_day_off',
      reason: 'Día libre fijo',
    });
  }

  // 2. Check specific absences
  const absencesForDate = absences.filter(a => {
    const startDate = new Date(a.startDate);
    const endDate = new Date(a.endDate);
    const checkDate = new Date(dateStr);
    return checkDate >= startDate && checkDate <= endDate;
  });

  for (const absence of absencesForDate) {
    if (!absence.startTime || !absence.endTime) {
      // Full day absence
      conflicts.push({
        type: 'absence',
        reason: ABSENCE_TYPE_CONFIG[absence.absenceType].label,
        absenceType: absence.absenceType,
        locationName: absence.locationName || undefined,
      });
    } else {
      // Hourly absence - check overlap
      if (timeRangesOverlap(taskStartTime, taskEndTime, absence.startTime, absence.endTime)) {
        conflicts.push({
          type: 'absence',
          reason: absence.locationName || ABSENCE_TYPE_CONFIG[absence.absenceType].label,
          absenceType: absence.absenceType,
          timeRange: formatTimeRange(absence.startTime, absence.endTime),
          locationName: absence.locationName || undefined,
        });
      }
    }
  }

  // 3. Check maintenance cleanings
  const maintenanceForDay = maintenanceCleanings.filter(m => 
    m.isActive && m.daysOfWeek.includes(dayOfWeek)
  );

  for (const maintenance of maintenanceForDay) {
    if (timeRangesOverlap(taskStartTime, taskEndTime, maintenance.startTime, maintenance.endTime)) {
      conflicts.push({
        type: 'maintenance',
        reason: maintenance.locationName,
        timeRange: formatTimeRange(maintenance.startTime, maintenance.endTime),
        locationName: maintenance.locationName,
      });
    }
  }

  return {
    available: conflicts.length === 0,
    conflicts,
  };
};

// Get absence info for a specific cleaner on a specific date
export const getWorkerAbsenceInfo = (
  date: Date,
  absences: WorkerAbsence[],
  fixedDaysOff: WorkerFixedDayOff[],
  maintenanceCleanings: WorkerMaintenanceCleaning[]
): {
  hasFullDayAbsence: boolean;
  absenceType?: string;
  absenceReason?: string;
  hourlyBlockages: Array<{
    startTime: string;
    endTime: string;
    reason: string;
    type: 'absence' | 'maintenance';
    color: string;
  }>;
} => {
  const dayOfWeek = date.getDay();
  const dateStr = date.toISOString().split('T')[0];

  // Check fixed day off first
  const fixedDayOff = fixedDaysOff.find(d => d.dayOfWeek === dayOfWeek && d.isActive);
  if (fixedDayOff) {
    return {
      hasFullDayAbsence: true,
      absenceType: 'day_off',
      absenceReason: 'Día libre fijo',
      hourlyBlockages: [],
    };
  }

  // Check full day absences
  const absencesForDate = absences.filter(a => {
    const startDate = new Date(a.startDate);
    const endDate = new Date(a.endDate);
    const checkDate = new Date(dateStr);
    return checkDate >= startDate && checkDate <= endDate;
  });

  const fullDayAbsence = absencesForDate.find(a => !a.startTime || !a.endTime);
  if (fullDayAbsence) {
    return {
      hasFullDayAbsence: true,
      absenceType: fullDayAbsence.absenceType,
      absenceReason: fullDayAbsence.locationName || ABSENCE_TYPE_CONFIG[fullDayAbsence.absenceType].label,
      hourlyBlockages: [],
    };
  }

  // Collect hourly blockages
  const hourlyBlockages: Array<{
    startTime: string;
    endTime: string;
    reason: string;
    type: 'absence' | 'maintenance';
    color: string;
  }> = [];

  // Add hourly absences
  for (const absence of absencesForDate) {
    if (absence.startTime && absence.endTime) {
      hourlyBlockages.push({
        startTime: absence.startTime,
        endTime: absence.endTime,
        reason: absence.locationName || ABSENCE_TYPE_CONFIG[absence.absenceType].label,
        type: 'absence',
        color: ABSENCE_TYPE_CONFIG[absence.absenceType].color,
      });
    }
  }

  // Add maintenance cleanings for this day
  const maintenanceForDay = maintenanceCleanings.filter(m => 
    m.isActive && m.daysOfWeek.includes(dayOfWeek)
  );

  for (const maintenance of maintenanceForDay) {
    hourlyBlockages.push({
      startTime: maintenance.startTime,
      endTime: maintenance.endTime,
      reason: maintenance.locationName,
      type: 'maintenance',
      color: '#EAB308', // Yellow for maintenance
    });
  }

  return {
    hasFullDayAbsence: false,
    hourlyBlockages,
  };
};

// Hook to use worker availability check with React
export const useWorkerAvailabilityCheck = (
  cleanerId: string,
  date: Date,
  taskStartTime: string,
  taskEndTime: string,
  absences: WorkerAbsence[],
  fixedDaysOff: WorkerFixedDayOff[],
  maintenanceCleanings: WorkerMaintenanceCleaning[]
) => {
  return useMemo(() => {
    return checkWorkerConflicts(
      date,
      taskStartTime,
      taskEndTime,
      absences.filter(a => a.cleanerId === cleanerId),
      fixedDaysOff.filter(f => f.cleanerId === cleanerId),
      maintenanceCleanings.filter(m => m.cleanerId === cleanerId)
    );
  }, [cleanerId, date, taskStartTime, taskEndTime, absences, fixedDaysOff, maintenanceCleanings]);
};
