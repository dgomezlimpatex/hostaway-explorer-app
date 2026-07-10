import {
  buildProposalSignature,
  validateProposalBatchForApply,
  type ProposalBatchTaskPlan,
} from '../src/utils/cleaning-planning/proposalBatchApply';
import { executeProposalBatch } from '../src/utils/cleaning-planning/proposalBatchExecution';
import { executeCanonicalTaskAssignmentChange } from '../src/utils/taskAssignmentExecution';
import type { AssignmentProposal } from '../src/types/cleaningPlanning';
import type { Task } from '../src/types/calendar';

type Assert = typeof import('node:assert/strict');

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  created_at: '2026-07-10T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
  property: 'MARINA30 201',
  address: 'A Coruña',
  startTime: '11:00',
  endTime: '12:10',
  type: 'cleaning',
  status: 'pending',
  checkOut: '11:00',
  checkIn: '15:00',
  date: '2026-07-13',
  sedeId: 'sede-1',
  ...overrides,
});

const proposal = (overrides: Partial<AssignmentProposal> = {}): AssignmentProposal => ({
  taskId: 'task-1',
  cleanerId: 'cleaner-1',
  cleanerName: 'Ana',
  durationMinutes: 70,
  proposedStartTime: '12:20',
  proposedEndTime: '13:30',
  confidence: 90,
  reasons: [],
  warnings: [],
  capacityAfterAssignment: { assignedMinutes: 70, remainingMinutes: 300 },
  ...overrides,
});

export async function run(assert: Assert) {
  const reviewedProposal = proposal();
  const changedScheduleProposal = proposal({ proposedStartTime: '13:40', proposedEndTime: '14:50' });

  assert.notEqual(
    buildProposalSignature([reviewedProposal]),
    buildProposalSignature([changedScheduleProposal]),
    'proposal signature must protect the reviewed proposed schedule as well as the cleaner',
  );

  const validation = validateProposalBatchForApply({
    proposals: [reviewedProposal],
    proposalSignature: buildProposalSignature([reviewedProposal]),
    activeSedeId: 'sede-1',
    activeCleanerIds: ['cleaner-1'],
    expectedTasks: [task()],
    freshTasks: [task()],
  });

  assert.equal(validation.canApply, true);
  assert.equal(validation.taskPlans.length, 1);
  assert.equal(validation.taskPlans[0].proposedStartTime, '12:20');
  assert.equal(validation.taskPlans[0].proposedEndTime, '13:30');
  assert.equal(validation.taskPlans[0].previousStartTime, '11:00');
  assert.equal(validation.taskPlans[0].previousEndTime, '12:10');

  const plan = validation.taskPlans[0] as ProposalBatchTaskPlan;
  const successCalls: string[] = [];
  const success = await executeProposalBatch([plan], {
    updateSchedule: async (taskId, startTime, endTime) => {
      successCalls.push(`schedule:${taskId}:${startTime}-${endTime}`);
    },
    setAssignments: async (taskId, cleanerIds) => {
      successCalls.push(`assign:${taskId}:${cleanerIds.join(',')}`);
      return { added: [], removed: [], final: [] };
    },
  });

  assert.deepEqual(successCalls, [
    'schedule:task-1:12:20-13:30',
    'assign:task-1:cleaner-1',
  ]);
  assert.equal(success.length, 1);

  const rollbackCalls: string[] = [];
  await assert.rejects(
    executeProposalBatch([plan], {
      updateSchedule: async (taskId, startTime, endTime) => {
        rollbackCalls.push(`schedule:${taskId}:${startTime}-${endTime}`);
      },
      setAssignments: async (taskId, cleanerIds) => {
        rollbackCalls.push(`assign:${taskId}:${cleanerIds.join(',')}`);
        if (cleanerIds.includes('cleaner-1')) throw new Error('assignment failed');
        return { added: [], removed: [], final: [] };
      },
    }),
    /assignment failed/,
  );
  assert.deepEqual(rollbackCalls, [
    'schedule:task-1:12:20-13:30',
    'assign:task-1:cleaner-1',
    'assign:task-1:',
    'schedule:task-1:11:00-12:10',
  ]);

  const manualCalls: string[] = [];
  const manualDependencies = {
    setAssignments: async (taskId: string, cleanerIds: string[]) => {
      manualCalls.push(`assign:${taskId}:${cleanerIds.join(',')}`);
      return { added: [], removed: [], final: [] };
    },
    updateSchedule: async (taskId: string, startTime: string, endTime: string) => {
      manualCalls.push(`schedule:${taskId}:${startTime}-${endTime}`);
    },
  };

  await executeCanonicalTaskAssignmentChange({
    taskId: 'task-1',
    nextCleanerIds: ['cleaner-2'],
    previousCleanerIds: ['cleaner-1'],
  }, manualDependencies);
  await executeCanonicalTaskAssignmentChange({
    taskId: 'task-1',
    nextCleanerIds: [],
    previousCleanerIds: ['cleaner-2'],
  }, manualDependencies);
  await executeCanonicalTaskAssignmentChange({
    taskId: 'task-1',
    nextCleanerIds: ['cleaner-3'],
    previousCleanerIds: [],
    nextSchedule: { startTime: '14:00', endTime: '15:10' },
    previousSchedule: { startTime: '11:00', endTime: '12:10' },
  }, manualDependencies);

  assert.deepEqual(manualCalls, [
    'assign:task-1:cleaner-2',
    'assign:task-1:',
    'schedule:task-1:14:00-15:10',
    'assign:task-1:cleaner-3',
  ]);
}
