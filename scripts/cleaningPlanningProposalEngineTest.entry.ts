import { buildAssignmentProposal, validateDraftAssignmentMove } from '../src/utils/cleaning-planning/proposalEngine';
import type { Cleaner } from '../src/types/calendar';
import type { CleaningPlanningTask, EffectiveWorkerAvailability, GlobalPlanQualitySummary } from '../src/types/cleaningPlanning';
import type { CleanerGroupAssignment } from '../src/types/propertyGroups';
import { applyBuildingOperationalWindow } from '../src/utils/cleaning-planning/buildingOperationalWindow';

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
  const buildingWindowOverridesPropertyWindow = applyBuildingOperationalWindow(
    fallbackTask({ checkOut: '10:00', checkIn: '15:00' }),
    detectedBuilding,
    [{
      id: 'group-md18',
      name: 'MD18',
      checkOutTime: '12:00',
      checkInTime: '16:30',
      isActive: true,
      autoAssignEnabled: false,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    }],
  );
  assert.equal(buildingWindowOverridesPropertyWindow.checkOut, '12:00', 'building checkout must override the property/task checkout in planning');
  assert.equal(buildingWindowOverridesPropertyWindow.checkIn, '16:30', 'building checkin must override the property/task checkin in planning');

  const standalonePropertyKeepsOwnWindow = applyBuildingOperationalWindow(
    fallbackTask({ checkOut: '10:00', checkIn: '15:00' }),
    { status: 'missing', reason: 'standalone fixture' },
    [],
  );
  assert.equal(standalonePropertyKeepsOwnWindow.checkOut, '10:00', 'standalone properties must keep their own checkout');
  assert.equal(standalonePropertyKeepsOwnWindow.checkIn, '15:00', 'standalone properties must keep their own checkin');

  const dateSpecificAvailability = proposalFor(
    [fallbackTask({ id: 'task-date', date: '2026-07-01' })],
    [
      availability('2026-07-01', 0, false),
      availability('2026-07-02', 480, true),
    ],
  );
  assert.equal(dateSpecificAvailability.proposals.length, 0, 'must not use another day availability for the task date');
  assert.deepEqual(dateSpecificAvailability.conflicts.map((conflict) => conflict.code), ['no_available_worker']);

  const lateShiftInsideOperationalWindow = proposalFor(
    [fallbackTask({
      id: 'task-late-shift',
      startTime: '11:00',
      endTime: '12:30',
      checkOut: '11:00',
      checkIn: '19:00',
      durationMinutes: 90,
      duration: 90,
    })],
    [{
      ...availability('2026-07-01', 180, true),
      availableWindows: [{ startTime: '15:00', endTime: '18:00' }],
      availableMinutes: 180,
      remainingMinutes: 180,
    }],
  );
  assert.equal(lateShiftInsideOperationalWindow.proposals.length, 1, 'a worker available later inside checkout-checkin must receive the task');
  assert.equal(lateShiftInsideOperationalWindow.proposals[0]?.proposedStartTime, '15:00', 'proposal must start at the first real worker availability, not always at checkout');
  assert.equal(lateShiftInsideOperationalWindow.proposals[0]?.proposedEndTime, '16:30');
  assert.equal(lateShiftInsideOperationalWindow.conflicts.length, 0);

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
      fallbackTask({ id: 'task-overlap-1', startTime: '10:00', endTime: '12:00', checkOut: '10:00', checkIn: '12:00', durationMinutes: 120, duration: 120 }),
      fallbackTask({
        id: 'task-overlap-2',
        property: 'AB1.1',
        propertyCode: 'AB1.1',
        propertyName: 'AB1.1',
        startTime: '10:30',
        endTime: '12:30',
        checkOut: '10:30',
        checkIn: '12:30',
        durationMinutes: 120,
        duration: 120,
        detectedBuilding: {
          status: 'detected' as const,
          propertyGroupId: 'group-ab1',
          propertyGroupName: 'AB1',
          reason: 'fixture',
        },
      }),
    ],
    [availability('2026-07-01', 480, true)],
    [
      { ...cleanerGroupAssignments[0], maxTasksPerDay: 10 },
      { ...cleanerGroupAssignments[0], id: 'assignment-ana-ab1', propertyGroupId: 'group-ab1', maxTasksPerDay: 10 },
    ],
  );
  assert.equal(overlapsAreRejected.proposals.length, 1, 'proposal engine must not create overlapping tasks for the same cleaner across different buildings');
  assert.deepEqual(overlapsAreRejected.conflicts.map((conflict) => conflict.code), ['no_available_worker']);

  const sameBuildingTasksArePackedWithOneCleaner = proposalFor(
    [
      fallbackTask({ id: 'task-pack-101', property: 'AB1.101', propertyCode: 'AB1.101', propertyName: 'AB1.101', startTime: '11:00', endTime: '11:30', durationMinutes: 30, duration: 30, checkOut: '11:00', checkIn: '15:00' }),
      fallbackTask({ id: 'task-pack-102', property: 'AB1.102', propertyCode: 'AB1.102', propertyName: 'AB1.102', startTime: '11:00', endTime: '11:30', durationMinutes: 30, duration: 30, checkOut: '11:00', checkIn: '15:00' }),
      fallbackTask({ id: 'task-pack-601', property: 'AB1.601', propertyCode: 'AB1.601', propertyName: 'AB1.601', startTime: '11:00', endTime: '11:30', durationMinutes: 30, duration: 30, checkOut: '11:00', checkIn: '15:00' }),
    ],
    [
      { ...availability('2026-07-01', 240, true, 'ana'), availableWindows: [{ startTime: '09:00', endTime: '17:00' }] },
      { ...availability('2026-07-01', 240, true, 'bea'), availableWindows: [{ startTime: '09:00', endTime: '17:00' }] },
      { ...availability('2026-07-01', 240, true, 'carla'), availableWindows: [{ startTime: '09:00', endTime: '17:00' }] },
    ],
    cleanerGroupAssignments.map((assignment) => ({ ...assignment, maxTasksPerDay: 10 })),
  );
  assert.equal(sameBuildingTasksArePackedWithOneCleaner.proposals.length, 3, 'all same-building tasks should be proposed when one cleaner can cover the pack');
  assert.deepEqual(sameBuildingTasksArePackedWithOneCleaner.proposals.map((proposal) => proposal.cleanerId), ['ana', 'ana', 'ana'], 'same-building tasks inside checkout-checkin should stay with the same worker when capacity allows');
  assert.deepEqual(sameBuildingTasksArePackedWithOneCleaner.proposals.map((proposal) => `${proposal.proposedStartTime}-${proposal.proposedEndTime}`), ['11:00-11:30', '11:40-12:10', '12:20-12:50'], 'same-building tasks should be sequenced with the same-building buffer inside checkout-checkin');
  assert.equal(sameBuildingTasksArePackedWithOneCleaner.conflicts.length, 0);
  const sameBuildingQuality = sameBuildingTasksArePackedWithOneCleaner.summary.globalQuality as GlobalPlanQualitySummary;
  assert.equal(sameBuildingQuality.fullBundlesCovered, 1, 'global quality should count a same-building pack covered by one worker');
  assert.equal(sameBuildingQuality.splitBundles, 0, 'global quality should not flag a packed centre as split');
  assert.equal(sameBuildingQuality.avoidableSplits, 0, 'global quality should not flag avoidable splits when Hermes keeps the centre together');

  const marinaLikeBundleUsesMinimumViableCrew = proposalFor(
    [
      fallbackTask({ id: 'marina-201', property: 'M30.201', propertyCode: 'M30.201', propertyName: 'M30.201', startTime: '12:00', endTime: '13:10', durationMinutes: 70, duration: 70, checkOut: '12:00', checkIn: '16:00' }),
      fallbackTask({ id: 'marina-301', property: 'M30.301', propertyCode: 'M30.301', propertyName: 'M30.301', startTime: '12:00', endTime: '13:10', durationMinutes: 70, duration: 70, checkOut: '12:00', checkIn: '16:00' }),
      fallbackTask({ id: 'marina-302', property: 'M30.302', propertyCode: 'M30.302', propertyName: 'M30.302', startTime: '12:00', endTime: '13:10', durationMinutes: 70, duration: 70, checkOut: '12:00', checkIn: '16:00' }),
      fallbackTask({ id: 'marina-401', property: 'M30.401', propertyCode: 'M30.401', propertyName: 'M30.401', startTime: '13:20', endTime: '14:30', durationMinutes: 70, duration: 70, checkOut: '12:00', checkIn: '16:00' }),
      fallbackTask({ id: 'marina-402', property: 'M30.402', propertyCode: 'M30.402', propertyName: 'M30.402', startTime: '13:20', endTime: '14:30', durationMinutes: 70, duration: 70, checkOut: '12:00', checkIn: '16:00' }),
      fallbackTask({ id: 'marina-502', property: 'M30.502', propertyCode: 'M30.502', propertyName: 'M30.502', startTime: '13:20', endTime: '14:30', durationMinutes: 70, duration: 70, checkOut: '12:00', checkIn: '16:00' }),
    ],
    [
      { ...availability('2026-07-01', 240, true, 'ana'), availableWindows: [{ startTime: '09:00', endTime: '17:00' }] },
      { ...availability('2026-07-01', 240, true, 'bea'), availableWindows: [{ startTime: '09:00', endTime: '17:00' }] },
      { ...availability('2026-07-01', 240, true, 'carla'), availableWindows: [{ startTime: '09:00', endTime: '17:00' }] },
      { ...availability('2026-07-01', 240, true, 'diana'), availableWindows: [{ startTime: '09:00', endTime: '17:00' }] },
    ],
    [
      { ...cleanerGroupAssignments[0], cleanerId: 'ana', roleType: 'primary', maxTasksPerDay: 10 },
      { ...cleanerGroupAssignments[1], cleanerId: 'bea', roleType: 'secondary', maxTasksPerDay: 10 },
      { ...cleanerGroupAssignments[2], cleanerId: 'carla', roleType: 'secondary', maxTasksPerDay: 10 },
      { ...cleanerGroupAssignments[2], id: 'assignment-diana-md18', cleanerId: 'diana', roleType: 'backup', priority: 4, maxTasksPerDay: 10 },
    ],
  );
  assert.equal(marinaLikeBundleUsesMinimumViableCrew.proposals.length, 6, 'all Marina-like same-building tasks should be covered');
  assert.equal(new Set(marinaLikeBundleUsesMinimumViableCrew.proposals.map((proposal) => proposal.cleanerId)).size, 2, 'Marina-like same-building pack should use the minimum viable crew, not one worker per simultaneous card');
  assert.deepEqual(
    Array.from(marinaLikeBundleUsesMinimumViableCrew.proposals.reduce((counts, proposal) => counts.set(proposal.cleanerId, (counts.get(proposal.cleanerId) || 0) + 1), new Map<string, number>()).values()).sort((a, b) => b - a),
    [3, 3],
    'two workers should each receive three sequenced same-building cleanings when capacity/window allow it',
  );

  const scarceTitularIsReservedForOnlyViableBuilding = proposalFor(
    [
      fallbackTask({ id: 'task-easy-ab1', property: 'AB1.1', propertyCode: 'AB1.1', propertyName: 'AB1.1', startTime: '09:00', endTime: '10:00', checkOut: '09:00', checkIn: '15:00', durationMinutes: 60, duration: 60, detectedBuilding: { status: 'detected' as const, propertyGroupId: 'group-ab1', propertyGroupName: 'AB1', reason: 'fixture' } }),
      fallbackTask({ id: 'task-critical-md18', property: 'MD18.9', propertyCode: 'MD18.9', propertyName: 'MD18.9', startTime: '13:00', endTime: '14:30', checkOut: '13:00', checkIn: '16:00', durationMinutes: 90, duration: 90 }),
    ],
    [
      { ...availability('2026-07-01', 150, true, 'ana'), availableWindows: [{ startTime: '09:00', endTime: '17:00' }] },
      { ...availability('2026-07-01', 120, true, 'bea'), availableWindows: [{ startTime: '09:00', endTime: '17:00' }] },
    ],
    [
      { ...cleanerGroupAssignments[0], id: 'assignment-ana-ab1-scarce', propertyGroupId: 'group-ab1', cleanerId: 'ana', roleType: 'primary', maxTasksPerDay: 10 },
      { ...cleanerGroupAssignments[1], id: 'assignment-bea-ab1-scarce', propertyGroupId: 'group-ab1', cleanerId: 'bea', roleType: 'secondary', maxTasksPerDay: 10 },
      { ...cleanerGroupAssignments[0], id: 'assignment-ana-md18-scarce', propertyGroupId: 'group-md18', cleanerId: 'ana', roleType: 'primary', maxTasksPerDay: 10 },
    ],
  );
  assert.equal(scarceTitularIsReservedForOnlyViableBuilding.conflicts.length, 0, 'global optimizer should avoid consuming the only viable worker for a later critical centre');
  assert.deepEqual(
    scarceTitularIsReservedForOnlyViableBuilding.proposals.map((proposal) => `${proposal.taskId}:${proposal.cleanerId}`),
    ['task-easy-ab1:bea', 'task-critical-md18:ana'],
    'easy centre should use suplente so the scarce titular remains available for the centre only she can cover',
  );
  const scarceTitularQuality = scarceTitularIsReservedForOnlyViableBuilding.summary.globalQuality as GlobalPlanQualitySummary;
  assert.ok(scarceTitularQuality.criticalWarnings.some((warning) => warning.includes('Ana') && warning.includes('MD18')), 'global quality should explain why a scarce titular was reserved');

  const splitBundleIsJustifiedWhenNobodyCoversFullCentre = proposalFor(
    [
      fallbackTask({ id: 'task-split-1', startTime: '10:00', endTime: '11:00', checkOut: '10:00', checkIn: '13:00', durationMinutes: 60, duration: 60 }),
      fallbackTask({ id: 'task-split-2', startTime: '10:00', endTime: '11:00', checkOut: '10:00', checkIn: '13:00', durationMinutes: 60, duration: 60 }),
      fallbackTask({ id: 'task-split-3', startTime: '10:00', endTime: '11:00', checkOut: '10:00', checkIn: '13:00', durationMinutes: 60, duration: 60 }),
    ],
    [
      { ...availability('2026-07-01', 140, true, 'ana'), availableWindows: [{ startTime: '09:00', endTime: '17:00' }] },
      { ...availability('2026-07-01', 140, true, 'bea'), availableWindows: [{ startTime: '09:00', endTime: '17:00' }] },
      { ...availability('2026-07-01', 140, true, 'carla'), availableWindows: [{ startTime: '09:00', endTime: '17:00' }] },
    ],
    cleanerGroupAssignments.map((assignment) => ({ ...assignment, roleType: assignment.cleanerId === 'ana' ? 'primary' : assignment.cleanerId === 'bea' ? 'secondary' : 'backup', maxTasksPerDay: 10 })),
  );
  assert.equal(splitBundleIsJustifiedWhenNobodyCoversFullCentre.proposals.length, 3, 'split centre should still cover every task when no single worker can cover the full bundle');
  assert.equal(new Set(splitBundleIsJustifiedWhenNobodyCoversFullCentre.proposals.map((proposal) => proposal.cleanerId)).size, 2, 'centre should be split into the minimum viable number of workers');
  const splitBundleQuality = splitBundleIsJustifiedWhenNobodyCoversFullCentre.summary.globalQuality as GlobalPlanQualitySummary;
  assert.equal(splitBundleQuality.splitBundles, 1, 'global quality should count split centres');
  assert.equal(splitBundleQuality.avoidableSplits, 0, 'split should not be avoidable when no single worker can cover full bundle');
  assert.ok(splitBundleQuality.criticalWarnings.some((warning) => warning.includes('se divide') && warning.includes('MD18')), 'split centre must explain why it was divided');

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
    [fallbackTask({ id: 'task-window-mismatch', startTime: '15:00', endTime: '17:00', checkOut: '15:00', checkIn: '17:00', durationMinutes: 120, duration: 120 })],
    [{ ...availability('2026-07-01', 480, true), availableWindows: [{ startTime: '09:00', endTime: '13:00' }] }],
  );
  assert.equal(outsideAvailabilityWindowIsRejected.proposals.length, 0, 'task checkout-checkin window must fit inside a real available window, not just available minutes');
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
      fallbackTask({ id: 'task-buffer-5b', startTime: '12:05', endTime: '14:05', checkIn: '14:05', durationMinutes: 120, duration: 120 }),
    ],
    [availability('2026-07-01', 300, true)],
    [{ ...cleanerGroupAssignments[0], maxTasksPerDay: 10 }],
  );
  assert.equal(sameBuildingLessThanTenMinuteBufferIsRejected.proposals.length, 1);
  assert.deepEqual(sameBuildingLessThanTenMinuteBufferIsRejected.conflicts.map((conflict) => conflict.code), ['no_available_worker']);

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

  const draftMoveBase = {
    task: fallbackTask({ id: 'task-draft-move', startTime: '10:00', endTime: '12:00', checkOut: '10:00', checkIn: '15:00' }),
    cleanerId: 'bea',
    cleaners,
    availability: [availability('2026-07-01', 1000, true, 'bea')],
    cleanerGroupAssignments,
    draftProposals: [],
    calendarTasks: [],
  };
  const validDraftMove = validateDraftAssignmentMove(draftMoveBase);
  assert.equal(validDraftMove.valid, true, 'a valid draft move should be accepted by the shared engine validator');
  assert.equal(validDraftMove.assignmentRole, 'secondary');
  assert.equal(validDraftMove.proposedStartTime, '10:00');
  assert.equal(validDraftMove.proposedEndTime, '12:00');

  const unavailableDraftMove = validateDraftAssignmentMove({
    ...draftMoveBase,
    availability: [availability('2026-07-01', 0, false, 'bea')],
  });
  assert.equal(unavailableDraftMove.valid, false, 'an unavailable worker must be a hard-invalid drop target');
  assert.equal(unavailableDraftMove.conflict?.code, 'no_available_worker');

  const overlapDraftMove = validateDraftAssignmentMove({
    ...draftMoveBase,
    draftProposals: [{
      taskId: 'other-task', cleanerId: 'bea', cleanerName: 'Bea', durationMinutes: 270,
      proposedStartTime: '10:30', proposedEndTime: '15:00', confidence: 100, reasons: [], warnings: [],
      capacityAfterAssignment: { assignedMinutes: 270, remainingMinutes: 30 },
    }],
    calendarTasks: [fallbackTask({ id: 'other-task', startTime: '10:30', endTime: '15:00', durationMinutes: 270, duration: 270 })],
  });
  assert.equal(overlapDraftMove.valid, false, 'a move that overlaps another draft assignment must be rejected');
  assert.ok(
    overlapDraftMove.conflict?.code === 'time_overlap' || overlapDraftMove.conflict?.code === 'availability_window_mismatch',
    'the shared validator should explain that no conflict-free operational window remains',
  );
}
