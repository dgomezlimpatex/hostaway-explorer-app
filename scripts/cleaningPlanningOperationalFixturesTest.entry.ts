import { buildAssignmentProposal } from '../src/utils/cleaning-planning/proposalEngine';
import {
  buildProposalSignature,
  validateProposalBatchForApply,
} from '../src/utils/cleaning-planning/proposalBatchApply';
import { buildCleaningWindow } from '../src/services/planning/planningWindows';
import { getTaskWorkerPlannedDurationMinutes } from '../src/utils/cleaning-planning/capacity';
import type { Cleaner, Task } from '../src/types/calendar';
import type { AssignmentProposal, CleaningPlanningTask, EffectiveWorkerAvailability } from '../src/types/cleaningPlanning';
import type { CleanerGroupAssignment } from '../src/types/propertyGroups';

type Assert = typeof import('node:assert/strict');

type SedeTask = Task & { sedeId?: string; requiredCleaners?: number };

const cleaners: Cleaner[] = [
  { id: 'ana', name: 'Ana', isActive: true, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
  { id: 'bea', name: 'Bea', isActive: true, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
  { id: 'cris-ourense', name: 'Cris Ourense', isActive: true, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
];

const groupAssignments: CleanerGroupAssignment[] = [
  { id: 'ga-ana-md18', propertyGroupId: 'group-md18', cleanerId: 'ana', priority: 1, maxTasksPerDay: 8, estimatedTravelTimeMinutes: 0, isActive: true, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z' },
  { id: 'ga-bea-md18', propertyGroupId: 'group-md18', cleanerId: 'bea', priority: 2, maxTasksPerDay: 8, estimatedTravelTimeMinutes: 0, isActive: true, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z' },
  { id: 'ga-ana-single', propertyGroupId: 'group-piso-azul', cleanerId: 'ana', priority: 1, maxTasksPerDay: 8, estimatedTravelTimeMinutes: 0, isActive: true, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z' },
  { id: 'ga-cris-md18', propertyGroupId: 'group-md18', cleanerId: 'cris-ourense', priority: 3, maxTasksPerDay: 8, estimatedTravelTimeMinutes: 0, isActive: true, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z' },
];

const detectedMd18 = {
  status: 'detected' as const,
  propertyGroupId: 'group-md18',
  propertyGroupName: 'MD18',
  reason: 'Fixture edificio MD18',
};

const detectedSingle = {
  status: 'detected' as const,
  propertyGroupId: 'group-piso-azul',
  propertyGroupName: 'PISOAZUL',
  reason: 'Fixture propiedad suelta',
};

const task = (overrides: Partial<CleaningPlanningTask> & { id: string }): CleaningPlanningTask => ({
  id: overrides.id,
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
  propertyId: `property-${overrides.id}`,
  durationMinutes: 120,
  durationSource: 'property',
  riskFlags: [],
  zone: 'A Coruña',
  detectedBuilding: detectedMd18,
  displayStatus: 'Pendiente',
  displayType: 'Cleaning',
  displayStartTime: '10:00',
  displayEndTime: '12:00',
  ...overrides,
});

const availability = (
  cleanerId: string,
  date: string,
  remainingMinutes: number,
  isAvailable = true,
): EffectiveWorkerAvailability => ({
  cleanerId,
  date,
  isAvailable,
  source: isAvailable ? 'weekly' : 'absence',
  availableWindows: isAvailable ? [{ startTime: '09:00', endTime: '17:00' }] : [],
  blockedWindows: isAvailable ? [] : [{ reason: 'Ausencia fixture' }],
  availableMinutes: isAvailable ? Math.max(remainingMinutes, 0) : 0,
  assignedMinutes: 0,
  remainingMinutes: isAvailable ? remainingMinutes : 0,
});

const toFreshTask = (planningTask: CleaningPlanningTask, sedeId = 'a-coruna'): SedeTask => ({
  ...planningTask,
  sedeId,
});

const buildProposal = (tasks: CleaningPlanningTask[], availabilities: EffectiveWorkerAvailability[]) => buildAssignmentProposal({
  tasks,
  cleaners,
  availability: availabilities,
  cleanerGroupAssignments: groupAssignments,
});

export async function run(assert: Assert) {
  const md18Tasks = [
    task({ id: 'md18-1', property: 'MD18.1', propertyCode: 'MD18.1', detectedBuilding: detectedMd18 }),
    task({ id: 'md18-1b', property: 'MD18.1B', propertyCode: 'MD18.1B', detectedBuilding: detectedMd18, startTime: '12:30', endTime: '14:30' }),
  ];
  const md18Proposal = buildProposal(md18Tasks, [availability('ana', '2026-07-01', 480), availability('bea', '2026-07-01', 480)]);
  assert.equal(md18Proposal.proposals.length, 2, 'edificio con varios apartamentos debe generar propuestas independientes');
  assert.deepEqual(new Set(md18Proposal.proposals.map((item) => item.propertyGroupName)), new Set(['MD18']));

  const singlePropertyProposal = buildProposal(
    [task({ id: 'piso-azul', property: 'PISOAZUL', propertyCode: 'PISOAZUL', detectedBuilding: detectedSingle })],
    [availability('ana', '2026-07-01', 480)],
  );
  assert.equal(singlePropertyProposal.proposals.length, 1, 'propiedad suelta con grupo operativo debe poder planificarse');
  assert.equal(singlePropertyProposal.proposals[0].propertyGroupName, 'PISOAZUL');

  const absenceProposal = buildProposal(
    [task({ id: 'ausencia-ana' })],
    [availability('ana', '2026-07-01', 480, false)],
  );
  assert.equal(absenceProposal.proposals.length, 0, 'limpiadora ausente no debe recibir propuesta');
  assert.deepEqual(absenceProposal.conflicts.map((conflict) => conflict.code), ['no_available_worker']);

  const cancelledProposal = buildProposal(
    [task({ id: 'cancelled-pms', status: 'cancelled' as CleaningPlanningTask['status'] })],
    [availability('ana', '2026-07-01', 480)],
  );
  assert.equal(cancelledProposal.summary.totalUnassignedTasks, 0, 'tarea cancelada desde PMS no debe entrar en planificación');

  const tightWindow = buildCleaningWindow({
    taskId: 'tight-checkout-checkin',
    propertyId: 'property-tight',
    checkoutAt: '2026-07-01T10:00:00+02:00',
    checkinAt: '2026-07-01T12:00:00+02:00',
    durationMinutes: 90,
  });
  assert.equal(tightWindow.status, 'insufficient_time', 'checkout/checkin con margen insuficiente debe bloquearse');

  const largeHouse = task({
    id: 'large-house-2-cleaners',
    property: 'CASA GRANDE',
    propertyCode: 'MD18.CASA',
    durationMinutes: 240,
    duration: 240,
    propertyDurationMinutes: 240,
    requiredCleaners: 2,
    startTime: '10:00',
    endTime: '14:00',
  } as Partial<CleaningPlanningTask> & { id: string });
  const largeHouseProposal = buildProposal(
    [largeHouse],
    [availability('ana', '2026-07-01', 180), availability('bea', '2026-07-01', 180)],
  );
  assert.equal(largeHouseProposal.proposals.length, 2, 'casa grande con requiredCleaners=2 debe proponer dos limpiadoras');
  assert.deepEqual(largeHouseProposal.proposals.map((item) => item.taskId), ['large-house-2-cleaners', 'large-house-2-cleaners']);
  assert.deepEqual(new Set(largeHouseProposal.proposals.map((item) => item.cleanerId)), new Set(['ana', 'bea']));

  const sanVicente = task({
    id: 'san-vicente-two-workers',
    property: 'SVCP San Vicente do Mar',
    propertyDurationMinutes: 600,
    durationMinutes: 600,
    duration: 600,
    requiredCleaners: 2,
  });
  assert.equal(
    getTaskWorkerPlannedDurationMinutes(sanVicente),
    300,
    'una tarea de 10 h repartida entre dos personas debe ocupar 5 h por trabajadora',
  );

  const sevenDayTasks = Array.from({ length: 7 }, (_, index) => task({
    id: `7d-${index + 1}`,
    date: `2026-07-0${index + 1}`,
    startTime: '10:00',
    endTime: '13:30',
    durationMinutes: 210,
    duration: 210,
  }));
  const sevenDayProposal = buildProposal(
    sevenDayTasks,
    Array.from({ length: 7 }, (_, index) => availability('ana', `2026-07-0${index + 1}`, 240)),
  );
  assert.equal(sevenDayProposal.proposals.length, 7, 'rango 7 días debe usar capacidad por día, no una bolsa agregada confusa');

  const activeProposal: AssignmentProposal[] = [
    ...md18Proposal.proposals,
    ...largeHouseProposal.proposals,
  ];
  const validBatch = validateProposalBatchForApply({
    proposals: activeProposal,
    proposalSignature: buildProposalSignature(activeProposal),
    activeSedeId: 'a-coruna',
    activeCleanerIds: ['ana', 'bea'],
    expectedTasks: [...md18Tasks, largeHouse].map((item) => toFreshTask(item, 'a-coruna')),
    freshTasks: [...md18Tasks, largeHouse].map((item) => toFreshTask(item, 'a-coruna')),
  });
  assert.equal(validBatch.canApply, true, 'batch válido debe ser aplicable');
  assert.deepEqual(
    validBatch.taskPlans.find((plan) => plan.taskId === 'large-house-2-cleaners')?.cleanerIds,
    ['ana', 'bea'],
    'batch debe agrupar varias propuestas de la misma tarea para escribir task_assignments',
  );

  const sedeMismatch = validateProposalBatchForApply({
    proposals: [md18Proposal.proposals[0]],
    proposalSignature: buildProposalSignature([md18Proposal.proposals[0]]),
    activeSedeId: 'a-coruna',
    activeCleanerIds: ['ana'],
    expectedTasks: [toFreshTask(md18Tasks[0], 'a-coruna')],
    freshTasks: [toFreshTask(md18Tasks[0], 'ourense')],
  });
  assert.equal(sedeMismatch.canApply, false, 'batch no debe mezclar sedes');
  assert.equal(sedeMismatch.items[0].status, 'blocked');
  assert.equal(sedeMismatch.items[0].reasonCode, 'sede_mismatch');

  const cancelledFresh = validateProposalBatchForApply({
    proposals: [md18Proposal.proposals[0]],
    proposalSignature: buildProposalSignature([md18Proposal.proposals[0]]),
    activeSedeId: 'a-coruna',
    activeCleanerIds: ['ana'],
    expectedTasks: [toFreshTask(md18Tasks[0], 'a-coruna')],
    freshTasks: [toFreshTask({ ...md18Tasks[0], status: 'cancelled' as CleaningPlanningTask['status'] }, 'a-coruna')],
  });
  assert.equal(cancelledFresh.canApply, false, 'batch debe revalidar estado fresco antes de guardar');
  assert.equal(cancelledFresh.items[0].reasonCode, 'invalid_status');

  const staleSignature = validateProposalBatchForApply({
    proposals: [md18Proposal.proposals[0]],
    proposalSignature: 'firma-obsoleta',
    activeSedeId: 'a-coruna',
    activeCleanerIds: ['ana'],
    expectedTasks: [toFreshTask(md18Tasks[0], 'a-coruna')],
    freshTasks: [toFreshTask(md18Tasks[0], 'a-coruna')],
  });
  assert.equal(staleSignature.canApply, false, 'firma obsoleta debe bloquear todo el batch');
  assert.equal(staleSignature.items[0].reasonCode, 'invalid_signature');
}
