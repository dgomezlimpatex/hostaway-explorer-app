import { buildCleaningPlanningModel } from '../src/utils/cleaningPlanning';
import { buildEffectiveAvailabilityRange } from '../src/utils/cleaning-planning/availability';
import type { Cleaner, Task } from '../src/types/calendar';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Assert = typeof import('node:assert/strict');

const cleaner: Cleaner = {
  id: 'cleaner-ana',
  name: 'Ana',
  isActive: true,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

const task = (id: string, status: string, cleanerId?: string): Task => ({
  id,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
  property: `Propiedad ${id}`,
  propertyCode: `P-${id}`,
  propertyDurationMinutes: 90,
  propertyName: `Propiedad ${id}`,
  propertyAddress: 'Fixture address',
  address: 'Fixture address',
  date: '2026-07-01',
  startTime: '10:00',
  endTime: '11:30',
  duration: 90,
  checkIn: '15:00',
  checkOut: '10:00',
  type: 'cleaning',
  status: status as Task['status'],
  cleaner: cleanerId ? 'Ana' : undefined,
  cleanerId,
  propertyId: `property-${id}`,
});

export async function run(assert: Assert) {
  const readSource = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');
  const actionsSource = readSource('src/hooks/useCleaningPlanningActions.ts');
  const batchExecutionSource = readSource('src/utils/cleaning-planning/proposalBatchExecution.ts');
  const multiAssignmentSource = readSource('src/services/storage/multipleTaskAssignmentService.ts');
  const taskAssignmentSource = readSource('src/services/storage/taskAssignmentService.ts');
  const notificationSource = readSource('src/services/notifications/notificationOrchestrator.ts');
  const notificationGrantMigration = readSource('supabase/migrations/20260705141000_grant_notification_events_insert.sql');
  const planningHookSource = readSource('src/hooks/useCleaningPlanning.ts');
  const recurringHookSource = readSource('src/hooks/useRecurringTaskInstances.ts');

  assert.match(
    planningHookSource,
    /useRecurringTaskInstances\(\{\s*dateFrom: range\.startDate,\s*dateTo: range\.endDate,\s*\}\)/,
    'Hermes planning must load recurring task instances for the selected range',
  );
  assert.match(
    planningHookSource,
    /assignedTasks: planningTasks/,
    'assigned recurring instances must reduce worker availability together with normal tasks',
  );
  assert.match(
    planningHookSource,
    /buildCleaningPlanningModel\(\s*planningTasks,/,
    'unassigned recurring instances must enter the same planning model as normal tasks',
  );
  assert.match(
    recurringHookSource,
    /propertyDurationMinutes:\s*rt\.properties\?\.duracion_servicio\s*\|\|\s*rt\.duracion/,
    'recurring instances must retain a template-duration fallback so assigned work never counts as zero capacity',
  );

  assert.match(
    actionsSource,
    /validateProposalBatchForApply\(/,
    'proposal application must validate a fresh batch before any write',
  );
  assert.match(
    actionsSource,
    /executeProposalBatch\(executablePlans/,
    'proposal application must execute the reviewed schedule and assignment plan together',
  );
  assert.match(
    actionsSource,
    /expectedTask\?\.isRecurringInstance[\s\S]*materializeRecurringTaskInstance\(expectedTask/,
    'virtual recurring proposals must be materialized before their schedule and assignments are persisted',
  );
  assert.match(
    actionsSource,
    /mutationFn: async \(\{ task, cleaner \}[\s\S]*task\.isRecurringInstance[\s\S]*materializeRecurringTaskInstance\(task/,
    'manual assignment from planning must materialize a virtual recurring occurrence',
  );
  assert.match(
    actionsSource,
    /mutationFn: async \(task: Task\)[\s\S]*task\.isRecurringInstance[\s\S]*materializeRecurringTaskInstance\(task/,
    'manual unassignment from planning must materialize a virtual recurring occurrence',
  );
  assert.match(
    actionsSource,
    /updateSchedule:[\s\S]*startTime[\s\S]*endTime[\s\S]*setAssignments:[\s\S]*notify: false/,
    'proposal application must persist proposed times before task_assignments without early notifications',
  );
  assert.match(
    batchExecutionSource,
    /previousCleanerIds[\s\S]*previousStartTime[\s\S]*previousEndTime/,
    'proposal application must attempt rollback to previous assignments and schedule if a batch step fails',
  );
  assert.match(
    actionsSource,
    /notifyAssignmentDiff\(item\.taskId, item\.result\.added, item\.result\.removed\)/,
    'proposal application must notify only after all task assignment writes succeed',
  );
  assert.match(
    actionsSource,
    /recordPlanningCopilotApply\(/,
    'proposal application must record planning-copilot audit after confirmation',
  );
  assert.match(
    multiAssignmentSource,
    /supabase\.rpc\('set_task_assignments'/,
    'multi-assignment service must use the atomic set_task_assignments RPC',
  );
  assert.match(
    taskAssignmentSource,
    /getTaskAssignments\(taskId\)/,
    'manual assignment changes must read the full canonical cleaner set for safe rollback',
  );
  assert.match(
    taskAssignmentSource,
    /executeCanonicalTaskAssignmentChange\([\s\S]*nextCleanerIds: \[cleanerId\]/,
    'manual calendar assignment and reassignment must replace canonical task_assignments',
  );
  assert.match(
    taskAssignmentSource,
    /async unassignTask[\s\S]*nextCleanerIds: \[\][\s\S]*setTaskAssignments/,
    'manual calendar unassignment must clear canonical task_assignments created by Hermes',
  );
  assert.doesNotMatch(
    taskAssignmentSource,
    /async unassignTask[\s\S]*\.update\(\{\s*cleaner: null,\s*cleaner_id: null/,
    'manual unassignment must not clear only legacy task columns',
  );
  assert.match(
    notificationSource,
    /status: 'pending'/,
    'notification orchestrator must always enqueue an auditable event for backend dispatch',
  );
  assert.doesNotMatch(
    notificationSource,
    /whatsappEnabled/,
    'the browser must not decide whether an operational event is deliverable',
  );
  assert.match(
    notificationGrantMigration,
    /GRANT INSERT ON public\.notification_events TO authenticated;/,
    'authenticated users covered by RLS must be allowed to insert notification_events from the planning UI',
  );

  const model = buildCleaningPlanningModel(
    [
      task('pending-unassigned', 'pending'),
      task('in-progress-assigned', 'in-progress', cleaner.id),
      task('completed-unassigned', 'completed'),
      task('cancelled-unassigned', 'cancelled'),
      task('declined-assigned', 'declined', cleaner.id),
      task('expired-unassigned', 'expired'),
    ],
    [cleaner],
    { [cleaner.id]: 480 },
    '2026-07-01',
    '2026-07-01',
  );

  assert.deepEqual(
    model.unassignedTasks.map((item) => item.id),
    ['pending-unassigned'],
    'only pending/in-progress unassigned tasks should be planifiable; cancelled/declined/expired must stay out',
  );

  assert.deepEqual(
    model.cleaners.flatMap((day) => day.tasks.map((item) => item.id)),
    ['in-progress-assigned'],
    'assigned tasks with invalid/cancelled statuses must not appear in cleaner planning columns',
  );

  assert.equal(model.summary.totalTasks, 2, 'summary must count only planifiable active tasks');

  const previousTimezone = process.env.TZ;
  process.env.TZ = 'Europe/Madrid';
  try {
    const rangeAvailability = buildEffectiveAvailabilityRange({
      cleaners: [cleaner],
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      weeklyAvailability: [
        { cleaner_id: cleaner.id, day_of_week: 3, is_available: true, start_time: '09:00', end_time: '17:00' },
        { cleaner_id: cleaner.id, day_of_week: 4, is_available: true, start_time: '09:00', end_time: '17:00' },
      ],
      assignedTasks: [
        task('pending-assigned-capacity', 'pending', cleaner.id),
        task('cancelled-assigned-capacity', 'cancelled', cleaner.id),
      ],
    });

    assert.deepEqual(
      rangeAvailability.map((item) => item.date),
      ['2026-07-01', '2026-07-02'],
      'availability date enumeration must preserve Madrid business dates without UTC off-by-one drift',
    );
    assert.equal(rangeAvailability[0].assignedMinutes, 90, 'availability capacity must ignore cancelled/invalid assigned tasks');
    assert.equal(rangeAvailability[0].remainingMinutes, 390, 'remaining capacity should subtract only active planifiable work');
    assert.deepEqual(
      rangeAvailability[0].blockedWindows,
      [{
        startTime: '10:00',
        endTime: '11:30',
        reason: 'Tarea ya asignada: Propiedad pending-assigned-capacity',
      }],
      'normal tasks assigned manually must block their real schedule so Hermes cannot overlap a new proposal',
    );

    const sharedSanVicenteTask = {
      ...task('san-vicente-manual', 'pending', cleaner.id),
      property: 'SVCP San Vicente do Mar',
      startTime: '11:00',
      endTime: '21:00',
      duration: 600,
      propertyDurationMinutes: 600,
      requiredCleaners: 2,
      assignments: [
        { cleaner_id: cleaner.id },
        { cleaner_id: 'cleaner-claudia' },
      ] as Task['assignments'],
    };
    const sharedTaskAvailability = buildEffectiveAvailabilityRange({
      cleaners: [cleaner],
      startDate: '2026-07-01',
      endDate: '2026-07-01',
      weeklyAvailability: [
        { cleaner_id: cleaner.id, day_of_week: 3, is_available: true, start_time: '09:00', end_time: '17:00' },
      ],
      assignedTasks: [sharedSanVicenteTask],
    });
    assert.equal(sharedTaskAvailability[0].assignedMinutes, 300, 'San Vicente must consume 5 hours per assigned worker');
    assert.equal(sharedTaskAvailability[0].remainingMinutes, 180, 'shared tasks must reduce capacity only once per worker');
    assert.deepEqual(
      sharedTaskAvailability[0].blockedWindows,
      [{
        startTime: '11:00',
        endTime: '16:00',
        reason: 'Tarea ya asignada: SVCP San Vicente do Mar',
      }],
      'San Vicente must block 11:00-16:00 for each assigned worker instead of allowing overlapping proposals',
    );

    const recurringAssignedTask = {
      ...task('recurring-assigned-capacity', 'pending', cleaner.id),
      id: 'recurring_rule-1_2026-07-01',
      isRecurringInstance: true,
      recurringTaskId: 'rule-1',
      duration: 120,
      propertyDurationMinutes: 120,
      startTime: '12:00',
      endTime: '14:00',
    };
    const recurringAvailability = buildEffectiveAvailabilityRange({
      cleaners: [cleaner],
      startDate: '2026-07-01',
      endDate: '2026-07-01',
      weeklyAvailability: [
        { cleaner_id: cleaner.id, day_of_week: 3, is_available: true, start_time: '09:00', end_time: '17:00' },
      ],
      assignedTasks: [recurringAssignedTask],
    });
    assert.equal(recurringAvailability[0].assignedMinutes, 120, 'assigned recurring instances must consume worker capacity');
    assert.equal(recurringAvailability[0].remainingMinutes, 360, 'worker remaining capacity must include assigned recurring work');

    const recurringPlanningModel = buildCleaningPlanningModel(
      [recurringAssignedTask, {
        ...task('recurring-unassigned', 'pending'),
        id: 'recurring_rule-2_2026-07-01',
        isRecurringInstance: true,
        recurringTaskId: 'rule-2',
      }],
      [cleaner],
      { [cleaner.id]: 480 },
      '2026-07-01',
      '2026-07-01',
    );
    assert.deepEqual(
      recurringPlanningModel.cleaners[0].tasks.map((item) => item.id),
      ['recurring_rule-1_2026-07-01'],
      'assigned recurring instances must appear in the worker plan',
    );
    assert.deepEqual(
      recurringPlanningModel.unassignedTasks.map((item) => item.id),
      ['recurring_rule-2_2026-07-01'],
      'unassigned recurring instances must appear in the Hermes planning queue',
    );

    const extraordinaryAvailability = buildEffectiveAvailabilityRange({
      cleaners: [cleaner],
      startDate: '2026-07-01',
      endDate: '2026-07-01',
      weeklyAvailability: [
        { cleaner_id: cleaner.id, day_of_week: 3, is_available: true, start_time: '09:00', end_time: '17:00' },
      ],
      assignedTasks: [{
        ...task('extraordinary-service', 'pending', cleaner.id),
        type: 'trabajo-extraordinario',
        startTime: '10:00',
        endTime: '14:00',
        duration: 240,
        propertyDurationMinutes: 240,
      }],
    });
    assert.deepEqual(
      extraordinaryAvailability[0].blockedWindows,
      [{ startTime: '10:00', endTime: '14:00', reason: 'Servicio extraordinario: Propiedad extraordinary-service' }],
      'assigned extraordinary services must block their exact time window in ordinary planning',
    );
    assert.equal(extraordinaryAvailability[0].availableMinutes, 240, 'extraordinary service window must reduce available daily minutes');
    assert.equal(extraordinaryAvailability[0].assignedMinutes, 0, 'extraordinary service must not be debited twice as assigned ordinary work');
    assert.equal(extraordinaryAvailability[0].remainingMinutes, 240, 'remaining capacity must reflect the extraordinary blocked window exactly once');
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
}
