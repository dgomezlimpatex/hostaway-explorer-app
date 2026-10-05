import type { Cleaner } from '../src/types/calendar';
import type { AssignmentProposal, AssignmentProposalResult, CleaningPlanningTask } from '../src/types/cleaningPlanning';
import type { CleanerGroupAssignment } from '../src/types/propertyGroups';
import { buildEffectiveAvailabilityRange } from '../src/utils/cleaning-planning/availability';
import { getTaskWorkerPlannedDurationMinutes } from '../src/utils/cleaning-planning/capacity';

export type PlanningExampleScenario = 'normal' | 'availability' | 'shared' | 'load';
const time = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function buildPlanningExample(scenario: PlanningExampleScenario, date = '2026-09-26') {
  const names = scenario === 'availability'
    ? ['Ana Martínez', 'Bea López', 'Carla García', 'Diego Pérez', 'Emma Ruiz', 'Félix Sánchez']
    : scenario === 'shared' ? ['Ana Martínez', 'Bea López', 'Carla García']
      : scenario === 'load' ? Array.from({ length: 20 }, (_, i) => `Trabajadora ${i + 1}`) : ['Ana Martínez'];
  const cleaners: Cleaner[] = names.map((name, i) => ({ id: `worker-${i + 1}`, name, isActive: true }));
  const makeTask = (id: string, property: string, startTime = '09:00', durationMinutes = 60, cleanerIds: string[] = []): CleaningPlanningTask => ({
    id, property, propertyCode: id === 'pending-1' ? 'AB1.4B' : property, propertyName: property,
    address: 'Calle de ejemplo', date, startTime, endTime: time(Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3)) + durationMinutes),
    displayStartTime: startTime, displayEndTime: time(Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3)) + durationMinutes),
    durationMinutes, duration: durationMinutes, propertyDurationMinutes: durationMinutes, durationSource: 'property', riskFlags: [], zone: 'Centro',
    displayStatus: 'Pendiente', displayType: 'Limpieza', type: 'cleaning', status: 'pending',
    checkIn: '17:00', checkOut: startTime, cleanerId: cleanerIds[0], requiredCleaners: Math.max(1, cleanerIds.length),
    assignments: cleanerIds.map(cleaner_id => ({ cleaner_id })),
    detectedBuilding: { status: 'detected', propertyGroupId: 'example-building', propertyGroupName: 'Santa Lucía Apartments · Edificio de ejemplo', reason: 'Datos de ejemplo' },
  } as CleaningPlanningTask);
  const tasks = scenario === 'load'
    ? Array.from({ length: 150 }, (_, i) => makeTask(`load-${i}`, `Apartamento ${i + 1}`, time(9 * 60 + Math.floor(i / 20) * 30), 15, i < 100 ? [cleaners[i % 20].id] : []))
    : [makeTask('pending-1', 'Apartamento Sol'), makeTask('existing-1', 'Apartamento Luna', '09:00', scenario === 'shared' ? 120 : 60, scenario === 'shared' ? ['worker-1', 'worker-2'] : ['worker-1']), makeTask('proposed-1', 'Apartamento Jardín', '11:00')];
  const proposedTasks = scenario === 'load' ? tasks.slice(100, 145) : [tasks[2]];
  const proposals: AssignmentProposal[] = proposedTasks.map((task, i) => ({
    taskId: task.id, cleanerId: cleaners[i % cleaners.length].id, cleanerName: cleaners[i % cleaners.length].name,
    propertyGroupId: 'example-building', propertyGroupName: 'Santa Lucía Apartments', assignmentRole: 'primary',
    durationMinutes: getTaskWorkerPlannedDurationMinutes(task), proposedStartTime: task.startTime, proposedEndTime: task.endTime,
    requiredCleaners: 1, assignmentIndex: 0, confidence: 1, reasons: [], warnings: [],
    capacityAfterAssignment: { assignedMinutes: task.durationMinutes, remainingMinutes: 360 },
  }));
  const proposal: AssignmentProposalResult = { proposals, conflicts: [], summary: {
    totalUnassignedTasks: tasks.filter(task => !task.cleanerId).length, proposedCount: proposals.length, conflictCount: 0,
    proposedMinutes: proposals.reduce((total, item) => total + item.durationMinutes, 0), remainingCapacityMinutes: 360, missingCapacityMinutes: 0,
  } };
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const weeklyAvailability = cleaners.filter(cleaner => scenario !== 'availability' || cleaner.id !== 'worker-5')
    .map(cleaner => ({ cleaner_id: cleaner.id, day_of_week: dayOfWeek, is_available: true, start_time: '09:00', end_time: '17:00' }));
  const effectiveAvailability = buildEffectiveAvailabilityRange({
    cleaners, startDate: date, endDate: date, weeklyAvailability, assignedTasks: tasks,
    ...(scenario === 'availability' ? {
      absences: [
        { id: 'full-absence', cleanerId: 'worker-3', startDate: date, endDate: date, startTime: null, endTime: null, absenceType: 'vacation' as const, notes: 'Vacaciones', locationName: null, createdBy: null, createdAt: '', updatedAt: '' },
        { id: 'partial-absence', cleanerId: 'worker-6', startDate: date, endDate: date, startTime: '10:00', endTime: '12:00', absenceType: 'personal' as const, notes: 'Cita', locationName: null, createdBy: null, createdAt: '', updatedAt: '' },
      ],
      fixedDaysOff: [{ id: 'fixed-off', cleanerId: 'worker-4', dayOfWeek, isActive: true, createdBy: null, createdAt: '', updatedAt: '' }],
      maintenanceCleanings: [
        { id: 'maintenance', cleanerId: 'worker-2', daysOfWeek: [dayOfWeek], startTime: '13:00', endTime: '15:00', scheduleType: 'maintenance' as const, locationName: 'Oficina de ejemplo', isActive: true, notes: null, createdBy: null, createdAt: '', updatedAt: '' },
        { id: 'restriction', cleanerId: 'worker-2', daysOfWeek: [dayOfWeek], startTime: '16:00', endTime: '17:00', scheduleType: 'unavailability' as const, locationName: '', isActive: true, notes: null, createdBy: null, createdAt: '', updatedAt: '' },
      ],
    } : {}),
  });
  const activeCleanerAssignments: CleanerGroupAssignment[] = cleaners.map((cleaner, i) => ({
    id: `team-${i}`, propertyGroupId: 'example-building', cleanerId: cleaner.id, priority: i + 1,
    roleType: 'primary', isActive: true, maxTasksPerDay: 20, estimatedTravelTimeMinutes: 0, createdAt: '', updatedAt: '',
  }));
  return { tasks, cleaners, proposal, effectiveAvailability, activeCleanerAssignments, weeklyAvailability };
}
