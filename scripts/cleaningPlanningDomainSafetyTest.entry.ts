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
  const multiAssignmentSource = readSource('src/services/storage/multipleTaskAssignmentService.ts');
  const notificationSource = readSource('src/services/notifications/notificationOrchestrator.ts');
  const notificationGrantMigration = readSource('supabase/migrations/20260705141000_grant_notification_events_insert.sql');

  assert.match(
    actionsSource,
    /validateProposalBatchForApply\(/,
    'proposal application must validate a fresh batch before any write',
  );
  assert.match(
    actionsSource,
    /setTaskAssignments\(plan\.taskId, plan\.cleanerIds, \{ notify: false \}\)/,
    'proposal application must write via task_assignments without early notifications',
  );
  assert.match(
    actionsSource,
    /Promise\.allSettled\([\s\S]*previousCleanerIds[\s\S]*notify: false/,
    'proposal application must attempt rollback to previous assignments if a batch step fails',
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
    notificationSource,
    /status: whatsappEnabled \? 'pending' : 'cancelled'/,
    'notification orchestrator must create an auditable event even when WhatsApp sending is disabled',
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
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
}
