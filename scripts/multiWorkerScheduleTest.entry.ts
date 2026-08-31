import assert from 'node:assert/strict';
import {
  getTaskWorkerCount,
  getTaskWorkerPlannedDurationMinutes,
} from '../src/utils/cleaning-planning/capacity';
import {
  getEffectiveTaskDurationMinutes,
  getEffectiveTaskEndTime,
} from '../src/utils/taskPositioning';
import { getTaskWorkerSchedule } from '../supabase/functions/_shared/taskWorkerSchedule';

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

  assert.equal(
    getEffectiveTaskEndTime({
      ...baseTask,
      assignmentCount: 2,
      propertyDurationMinutes: 720,
      duration: null,
      startTime: '09:30',
      endTime: '12:30',
    }),
    '11:00',
    'una ventana editada de 3 horas no debe ser sustituida por la estimacion de 12 horas de la propiedad',
  );

  assert.deepEqual(
    getTaskWorkerSchedule({
      startTime: '09:30',
      endTime: '13:30',
      durationMinutes: 720,
    }, 2),
    {
      startTime: '09:30',
      endTime: '11:30',
      durationMinutes: 120,
    },
    'las notificaciones deben repartir la ventana de 4 horas aunque la duracion guardada de la propiedad sea 12 horas',
  );

  console.log('multi-worker-schedule-runtime: OK');
}

run();
