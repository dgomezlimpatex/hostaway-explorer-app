import assert from 'node:assert/strict';
import { buildPlanningWeeklyWorkload } from '../src/utils/planningWeeklyWorkload';

const cleaners = [
  { id: 'laura', name: 'Laura', isActive: true, created_at: '', updated_at: '', contractHoursPerWeek: 30 },
  { id: 'ana', name: 'Ana', isActive: true, created_at: '', updated_at: '', contractHoursPerWeek: 20 },
  { id: 'inactive', name: 'Inactiva', isActive: false, created_at: '', updated_at: '' },
];

const task = (overrides = {}) => ({
  id: 'task-1',
  property: 'Casa grande',
  address: 'A Coruña',
  date: '2026-09-07',
  startTime: '09:00',
  endTime: '18:00',
  checkIn: '',
  checkOut: '',
  type: 'cleaning',
  status: 'pending',
  propertyDurationMinutes: 540,
  cleanerId: undefined,
  assignments: [],
  ...overrides,
});

export function run() {
  const multiWorker = buildPlanningWeeklyWorkload(
    [task({ assignments: [{ cleaner_id: 'laura' }, { cleaner_id: 'ana' }], assignmentCount: 2 })],
    cleaners,
  );
  assert.equal(multiWorker.find((row) => row.cleanerId === 'laura')?.assignedHours, 4.5);
  assert.equal(multiWorker.find((row) => row.cleanerId === 'ana')?.assignedHours, 4.5);

  const legacy = buildPlanningWeeklyWorkload(
    [task({ id: 'legacy', cleanerId: 'laura', assignments: [], propertyDurationMinutes: 120 })],
    cleaners,
  );
  assert.equal(legacy.find((row) => row.cleanerId === 'laura')?.assignedHours, 2);

  const cancelled = buildPlanningWeeklyWorkload(
    [task({ status: 'cancelled', cleanerId: 'laura', assignments: [], propertyDurationMinutes: 600 })],
    cleaners,
  );
  assert.equal(cancelled.find((row) => row.cleanerId === 'laura')?.assignedHours, 0);

  const missingDuration = buildPlanningWeeklyWorkload(
    [task({ id: 'missing', assignments: [{ cleaner_id: 'laura' }], propertyDurationMinutes: null })],
    cleaners,
  );
  assert.equal(missingDuration.find((row) => row.cleanerId === 'laura')?.missingDurationTaskCount, 1);

  const contractOverride = buildPlanningWeeklyWorkload(
    [task({ id: 'contract', cleanerId: 'ana', assignments: [], propertyDurationMinutes: 300 })],
    cleaners,
    [{ cleanerId: 'ana', contractHoursPerWeek: 10, isActive: true }],
  );
  const ana = contractOverride.find((row) => row.cleanerId === 'ana');
  assert.equal(ana?.contractHours, 10);
  assert.equal(ana?.remainingHours, 5);

  const profileFallback = buildPlanningWeeklyWorkload(
    [task({ id: 'profile-fallback', cleanerId: 'laura', assignments: [], propertyDurationMinutes: 60 })],
    cleaners,
    [{ cleanerId: 'laura', contractHoursPerWeek: 0, isActive: true }],
  );
  assert.equal(profileFallback.find((row) => row.cleanerId === 'laura')?.contractHours, 30);

  console.log('planning-weekly-workload-runtime: OK');
}
