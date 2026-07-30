import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'src/components/calendar/CalendarContainer.tsx'), 'utf8');
const taskMutationsSource = readFileSync(join(process.cwd(), 'src/hooks/useTasks.ts'), 'utf8');
const taskDetailsModalSource = readFileSync(
  join(process.cwd(), 'src/components/modals/TaskDetailsModal.tsx'),
  'utf8',
);
const calendarDataSource = readFileSync(
  join(process.cwd(), 'src/hooks/useCalendarData.ts'),
  'utf8',
);
const calendarLogicSource = readFileSync(
  join(process.cwd(), 'src/hooks/useCalendarLogic.ts'),
  'utf8',
);
const dragAndDropSource = readFileSync(
  join(process.cwd(), 'src/hooks/useDragAndDrop.ts'),
  'utf8',
);

assert.doesNotMatch(
  source,
  /taskAssignmentsForCalendar|\.from\('task_assignments'\)/,
  'El calendario no debe volver a consultar asignaciones que ya vienen con las tareas',
);
assert.match(
  source,
  /buildTaskAssignmentsMap/,
  'El calendario debe construir el mapa desde las asignaciones canónicas incluidas en cada tarea',
);
assert.match(
  taskMutationsSource,
  /createOptimisticAssignment[\s\S]*cleaner_id:\s*cleanerId/,
  'La actualización optimista debe poder construir una asignación canónica',
);
assert.match(
  taskMutationsSource,
  /assignments:\s*createOptimisticAssignment\(taskId,\s*cleanerId/,
  'La actualización optimista debe actualizar también el array canónico de la tarea',
);
assert.match(
  taskMutationsSource,
  /setQueriesData\([\s\S]{0,180}queryKey\[0\]\s*===\s*['"]tasks['"]/,
  'Las mutaciones optimistas deben actualizar las claves de tareas por rango, no una clave exacta inexistente',
);
assert.doesNotMatch(
  taskMutationsSource,
  /refetchType:\s*['"]none['"]/,
  'Las mutaciones de asignación no deben impedir la resincronización de las consultas activas',
);
assert.doesNotMatch(
  taskDetailsModalSource,
  /taskAssignmentService\.assignTask\([\s\S]{0,240}onUpdateTask\(/,
  'El modal no debe encadenar una segunda actualización genérica después de la asignación canónica',
);
assert.match(
  taskDetailsModalSource,
  /setQueriesData[\s\S]{0,700}assignments:\s*reconciledTask\.assignments/,
  'El modal debe actualizar todas las cachés tasks con la asignación canónica nueva',
);
assert.match(
  taskMutationsSource,
  /assignTaskWithSchedule:\s*assignTaskWithScheduleMutation\.mutateAsync/,
  'El drag debe poder esperar la mutación real de asignación y horario',
);
assert.match(
  calendarDataSource,
  /async[\s\S]{0,160}assignTaskWithScheduleMutation\(params\)/,
  'El wrapper del calendario debe propagar la promesa de asignación',
);
assert.match(
  calendarLogicSource,
  /await\s+assignTaskWithSchedule\(/,
  'El drag no debe desplazar otras tareas antes de confirmar la asignación principal',
);
assert.match(
  calendarLogicSource,
  /displaced\.map\(async[\s\S]{0,500}if\s*\(error\)\s*throw\s+error/,
  'Cada desplazamiento debe comprobar y propagar errores de Supabase',
);
assert.match(
  calendarLogicSource,
  /useCallback\(async\s*\(taskId:\s*string,\s*cleanerId:\s*string,\s*currentCleaners:\s*Cleaner\[\]/,
  'El callback de drag debe recibir las limpiadoras actuales como argumento de cada drop',
);
assert.match(
  dragAndDropSource,
  /onTaskAssign\(taskId,\s*cleanerId,\s*cleaners,\s*timeSlot\)/,
  'useDragAndDrop debe entregar la colección recibida en el drop, sin depender de un cierre obsoleto',
);

console.log('Calendar assignment reuse regression test passed');
