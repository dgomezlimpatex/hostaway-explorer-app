import assert from 'node:assert/strict';
import {
  getTaskWorkerCount,
  getTaskWorkerPlannedDurationMinutes,
} from '../src/utils/cleaning-planning/capacity';
import {
  getEffectiveTaskDurationMinutes,
  getEffectiveTaskEndTime,
} from '../src/utils/taskPositioning';

const baseTask = {
  id: 'casona-montellos',
  cleanerId: 'worker-1',
  assignments: [],
  requiredCleaners: 1,
  assignmentCount: 3,
  propertyDurationMinutes: 540,
  duration: 540,
  startTime: '11:00',
  endTime: '20:00',
};

export function run() {
  assert.equal(getTaskWorkerCount(baseTask), 3);
  assert.equal(getTaskWorkerPlannedDurationMinutes(baseTask), 180);
  assert.equal(getEffectiveTaskEndTime(baseTask), '14:00');
  assert.equal(getEffectiveTaskDurationMinutes(baseTask), 180);

  assert.equal(
    getEffectiveTaskEndTime({ ...baseTask, assignmentCount: 2 }),
    '15:30',
    '9 horas repartidas entre 2 trabajadores deben ser 4 h 30 min por persona',
  );
  assert.equal(
    getEffectiveTaskEndTime({ ...baseTask, assignmentCount: 1 }),
    '20:00',
    'con un trabajador se conserva el horario completo',
  );

  console.log('multi-worker-schedule-runtime: OK');
}

run();
