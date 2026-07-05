import { buildAssignmentProposal } from '../src/utils/cleaning-planning/proposalEngine';
import type { Cleaner } from '../src/types/calendar';
import type { CleaningPlanningTask, EffectiveWorkerAvailability } from '../src/types/cleaningPlanning';
import type { CleanerGroupAssignment } from '../src/types/propertyGroups';

type Assert = typeof import('node:assert/strict');

const detectedBuilding = {
  status: 'detected' as const,
  propertyGroupId: 'group-md18',
  propertyGroupName: 'MD18',
  reason: 'fixture',
};

const cleaners: Cleaner[] = [
  {
    id: 'ana',
    name: 'Ana',
    isActive: true,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bea',
    name: 'Bea',
    isActive: true,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'carla',
    name: 'Carla',
    isActive: true,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'diana',
    name: 'Diana',
    isActive: true,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  },
];

const cleanerGroupAssignments: CleanerGroupAssignment[] = [
  {
    id: 'assignment-ana',
    propertyGroupId: 'group-md18',
    cleanerId: 'ana',
    priority: 1,
    maxTasksPerDay: 1,
    estimatedTravelTimeMinutes: 30,
    isActive: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'assignment-bea',
    propertyGroupId: 'group-md18',
    cleanerId: 'bea',
    priority: 2,
    maxTasksPerDay: 10,
    estimatedTravelTimeMinutes: 30,
    isActive: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'assignment-carla',
    propertyGroupId: 'group-md18',
    cleanerId: 'carla',
    priority: 3,
    maxTasksPerDay: 10,
    estimatedTravelTimeMinutes: 30,
    isActive: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
];

const fallbackTask = (overrides: Partial<CleaningPlanningTask>): CleaningPlanningTask => ({
  id: overrides.id || 'task-1',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
  property: 'MD18.1',
  propertyCode: 'MD18.1',
  propertyDurationMinutes: 120,
  propertyName: 'MD18.1',
  propertyAddress: 'Fixture address',
  address: 'Fixture address',
  date: '2026-07-01',
  startTime: '10:00',
  endTime: '12:00',
  duration: 120,
  checkIn: '15:00',
  checkOut: '10:00',
  type: 'cleaning',
  status: 'pending',
  cleaner: undefined,
  cleanerId: undefined,
  propertyId: 'property-md18-1',
  durationMinutes: 120,
  durationSource: 'property',
  riskFlags: [],
  zone: 'A Coruña',
  detectedBuilding,
  displayStatus: 'Pendiente',
  displayType: 'Cleaning',
  displayStartTime: '10:00',
  displayEndTime: '12:00',
  ...overrides,
});

const availability = (
  date: string,
  remainingMinutes: number,
  isAvailable = true,
  cleanerId = 'ana',
): EffectiveWorkerAvailability => ({
  cleanerId,
  date,
  isAvailable,
  source: 'weekly',
  availableWindows: isAvailable ? [{ startTime: '09:00', endTime: '17:00' }] : [],
  blockedWindows: [],
  availableMinutes: isAvailable ? Math.max(remainingMinutes, 0) : 0,
  assignedMinutes: 0,
  remainingMinutes: isAvailable ? remainingMinutes : 0,
});

const proposalFor = (
  tasks: CleaningPlanningTask[],
  availabilities: EffectiveWorkerAvailability[],
  assignments: CleanerGroupAssignment[] = cleanerGroupAssignments,
) => buildAssignmentProposal({
  tasks,
  cleaners,
  availability: availabilities,
  cleanerGroupAssignments: assignments,
});

export async function run(assert: Assert) {
  const dateSpecificAvailability = proposalFor(
    [fallbackTask({ id: 'task-date', date: '2026-07-01' })],
    [
      availability('2026-07-01', 0, false),
      availability('2026-07-02', 480, true),
    ],
  );
  assert.equal(dateSpecificAvailability.proposals.length, 0, 'must not use another day availability for the task date');
  assert.deepEqual(dateSpecificAvailability.conflicts.map((conflict) => conflict.code), ['no_available_worker']);

  const bufferIsDebited = proposalFor(
    [
      fallbackTask({ id: 'task-buffer-1', startTime: '10:00', endTime: '12:15', durationMinutes: 135, duration: 135 }),
      fallbackTask({ id: 'task-buffer-2', startTime: '13:00', endTime: '15:15', durationMinutes: 135, duration: 135 }),
    ],
    [availability('2026-07-01', 300, true)],
    [{ ...cleanerGroupAssignments[0], maxTasksPerDay: 10 }],
  );
  assert.equal(bufferIsDebited.proposals.length, 2, '10 min same-building buffer must be reserved for every proposed task');
  assert.equal(bufferIsDebited.conflicts.length, 0);
  assert.equal(bufferIsDebited.proposals[1].capacityAfterAssignment.remainingMinutes, 10);

  const maxTasksPerDayIsEnforced = proposalFor(
    [
      fallbackTask({ id: 'task-max-1', startTime: '09:00', endTime: '10:00', durationMinutes: 60, duration: 60 }),
      fallbackTask({ id: 'task-max-2', startTime: '11:00', endTime: '12:00', durationMinutes: 60, duration: 60 }),
    ],
    [availability('2026-07-01', 480, true)],
  );
  assert.equal(maxTasksPerDayIsEnforced.proposals.length, 1, 'maxTasksPerDay must block excess same-day same-building proposals');
  assert.deepEqual(maxTasksPerDayIsEnforced.conflicts.map((conflict) => conflict.code), ['max_tasks_per_day']);

  const overlapsAreRejected = proposalFor(
    [
      fallbackTask({ id: 'task-overlap-1', startTime: '10:00', endTime: '12:00', durationMinutes: 120, duration: 120 }),
      fallbackTask({ id: 'task-overlap-2', startTime: '10:30', endTime: '12:30', durationMinutes: 120, duration: 120 }),
    ],
    [availability('2026-07-01', 480, true)],
    [{ ...cleanerGroupAssignments[0], maxTasksPerDay: 10 }],
  );
  assert.equal(overlapsAreRejected.proposals.length, 1, 'proposal engine must not create overlapping tasks for the same cleaner');
  assert.deepEqual(overlapsAreRejected.conflicts.map((conflict) => conflict.code), ['time_overlap']);

  const missingTimeIsRejected = proposalFor(
    [fallbackTask({ id: 'task-invalid-time', startTime: '', endTime: '', displayStartTime: 'Sin hora', displayEndTime: 'Sin hora' })],
    [availability('2026-07-01', 480, true)],
  );
  assert.equal(missingTimeIsRejected.proposals.length, 0, 'tasks without a valid time window need manual scheduling before proposal');
  assert.deepEqual(missingTimeIsRejected.conflicts.map((conflict) => conflict.code), ['invalid_time_window']);

  const invalidStatusesAreIgnored = proposalFor(
    [
      fallbackTask({ id: 'task-cancelled', status: 'cancelled' as CleaningPlanningTask['status'] }),
      fallbackTask({ id: 'task-expired', status: 'expired' as CleaningPlanningTask['status'] }),
    ],
    [availability('2026-07-01', 480, true)],
  );
  assert.equal(invalidStatusesAreIgnored.summary.totalUnassignedTasks, 0, 'proposal engine must ignore cancelled/expired raw PMS statuses');
  assert.equal(invalidStatusesAreIgnored.proposals.length, 0, 'proposal engine must not propose assignments for non-planifiable statuses');
  assert.equal(invalidStatusesAreIgnored.conflicts.length, 0, 'ignored non-planifiable statuses should not create operator noise');

  const outsideAvailabilityWindowIsRejected = proposalFor(
    [fallbackTask({ id: 'task-window-mismatch', startTime: '15:00', endTime: '17:00', durationMinutes: 120, duration: 120 })],
    [{ ...availability('2026-07-01', 480, true), availableWindows: [{ startTime: '09:00', endTime: '13:00' }] }],
  );
  assert.equal(outsideAvailabilityWindowIsRejected.proposals.length, 0, 'task must fit inside a real available window, not just available minutes');
  assert.deepEqual(outsideAvailabilityWindowIsRejected.conflicts.map((conflict) => conflict.code), ['availability_window_mismatch']);

  const sameBuildingTenMinuteBufferIsEnough = proposalFor(
    [
      fallbackTask({ id: 'task-buffer-10a', startTime: '10:00', endTime: '12:00', durationMinutes: 120, duration: 120 }),
      fallbackTask({ id: 'task-buffer-10b', startTime: '12:10', endTime: '14:10', durationMinutes: 120, duration: 120 }),
    ],
    [availability('2026-07-01', 260, true)],
    [{ ...cleanerGroupAssignments[0], maxTasksPerDay: 10 }],
  );
  assert.equal(sameBuildingTenMinuteBufferIsEnough.proposals.length, 2, 'same-building tasks separated by 10 minutes can chain');
  assert.equal(sameBuildingTenMinuteBufferIsEnough.conflicts.length, 0);

  const sameBuildingLessThanTenMinuteBufferIsRejected = proposalFor(
    [
      fallbackTask({ id: 'task-buffer-5a', startTime: '10:00', endTime: '12:00', durationMinutes: 120, duration: 120 }),
      fallbackTask({ id: 'task-buffer-5b', startTime: '12:05', endTime: '14:05', durationMinutes: 120, duration: 120 }),
    ],
    [availability('2026-07-01', 300, true)],
    [{ ...cleanerGroupAssignments[0], maxTasksPerDay: 10 }],
  );
  assert.equal(sameBuildingLessThanTenMinuteBufferIsRejected.proposals.length, 1);
  assert.deepEqual(sameBuildingLessThanTenMinuteBufferIsRejected.conflicts.map((conflict) => conflict.code), ['time_buffer_overlap']);

  const earlyCheckInIsPrioritized = proposalFor(
    [
      fallbackTask({ id: 'task-normal-checkin', startTime: '09:00', endTime: '10:00', checkIn: '17:00', durationMinutes: 60, duration: 60 }),
      fallbackTask({ id: 'task-early-checkin', startTime: '13:00', endTime: '14:00', checkIn: '14:00', durationMinutes: 60, duration: 60 }),
    ],
    [availability('2026-07-01', 70, true)],
    [{ ...cleanerGroupAssignments[0], maxTasksPerDay: 1 }],
  );
  assert.deepEqual(earlyCheckInIsPrioritized.proposals.map((proposal) => proposal.taskId), ['task-early-checkin'], 'early check-in at 14:00 must be prioritized before less critical tasks');

  const titularFallsBackToSuplente = proposalFor(
    [fallbackTask({ id: 'task-suplente' })],
    [
      availability('2026-07-01', 0, false, 'ana'),
      availability('2026-07-01', 200, true, 'bea'),
      availability('2026-07-01', 200, true, 'carla'),
    ],
  );
  assert.equal(titularFallsBackToSuplente.proposals[0].cleanerId, 'bea', 'if titular is unavailable, first suplente should be proposed');
  assert.ok(titularFallsBackToSuplente.proposals[0].warnings.some((warning) => warning.includes('suplente')));

  const suplenteFallsBackToBackup = proposalFor(
    [fallbackTask({ id: 'task-backup' })],
    [
      availability('2026-07-01', 0, false, 'ana'),
      availability('2026-07-01', 0, false, 'bea'),
      availability('2026-07-01', 200, true, 'carla'),
    ],
  );
  assert.equal(suplenteFallsBackToBackup.proposals[0].cleanerId, 'carla', 'if titular and suplente are unavailable, backup should be proposed');
  assert.ok(suplenteFallsBackToBackup.proposals[0].warnings.some((warning) => warning.includes('backup')));

  const roleTypeBeatsUnnormalizedPriority = proposalFor(
    [fallbackTask({ id: 'task-role-type-priority' })],
    [
      availability('2026-07-01', 200, true, 'ana'),
      availability('2026-07-01', 200, true, 'bea'),
      availability('2026-07-01', 200, true, 'carla'),
    ],
    [
      { ...cleanerGroupAssignments[2], cleanerId: 'carla', roleType: 'backup', priority: 9 },
      { ...cleanerGroupAssignments[1], cleanerId: 'bea', roleType: 'secondary', priority: 9 },
      { ...cleanerGroupAssignments[0], cleanerId: 'ana', roleType: 'primary', priority: 9 },
    ],
  );
  assert.equal(roleTypeBeatsUnnormalizedPriority.proposals[0].cleanerId, 'ana', 'explicit roleType primary must be proposed before secondary/backup when priorities are not normalized');
  assert.ok(roleTypeBeatsUnnormalizedPriority.proposals[0].reasons.some((reason) => reason.includes('titular')), 'primary roleType should explain titular/preferente, not backup');

  const largeHouseGetsThreeCleaners = proposalFor(
    [fallbackTask({ id: 'task-large-house', startTime: '11:00', endTime: '18:00', durationMinutes: 420, duration: 420, propertyDurationMinutes: 420 })],
    [
      { ...availability('2026-07-01', 180, true, 'ana'), availableWindows: [{ startTime: '09:00', endTime: '19:00' }] },
      { ...availability('2026-07-01', 180, true, 'bea'), availableWindows: [{ startTime: '09:00', endTime: '19:00' }] },
      { ...availability('2026-07-01', 180, true, 'carla'), availableWindows: [{ startTime: '09:00', endTime: '19:00' }] },
    ],
    cleanerGroupAssignments.map((assignment) => ({ ...assignment, maxTasksPerDay: 10 })),
  );
  assert.equal(largeHouseGetsThreeCleaners.proposals.length, 3, 'house over 6 hours should produce three cleaner assignments');
  assert.deepEqual(largeHouseGetsThreeCleaners.proposals.map((proposal) => proposal.cleanerId), ['ana', 'bea', 'carla']);
  assert.deepEqual(largeHouseGetsThreeCleaners.proposals.map((proposal) => proposal.durationMinutes), [140, 140, 140], 'large-house load should be split across cleaners');
  assert.deepEqual(largeHouseGetsThreeCleaners.proposals.map((proposal) => proposal.requiredCleaners), [3, 3, 3]);
}
