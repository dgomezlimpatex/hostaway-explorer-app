import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const optimizedTasksSource = readFileSync(
  join(process.cwd(), 'src/hooks/useOptimizedTasks.ts'),
  'utf8',
);
const calendarDataSource = readFileSync(
  join(process.cwd(), 'src/hooks/useCalendarData.ts'),
  'utf8',
);
const taskStorageSource = readFileSync(
  join(process.cwd(), 'src/services/storage/taskStorage.ts'),
  'utf8',
);
const cleaningCalendarSource = readFileSync(
  join(process.cwd(), 'src/components/CleaningCalendar.tsx'),
  'utf8',
);

for (const [name, source] of [
  ['useOptimizedTasks', optimizedTasksSource],
  ['useCalendarData', calendarDataSource],
]) {
  assert.match(
    source,
    /getTaskDateRange/,
    `${name} debe usar el rango civil canónico de Madrid`,
  );
  assert.match(
    source,
    /filterTasksByQueryRange/,
    `${name} debe usar el mismo rango para el filtrado posterior`,
  );
  assert.doesNotMatch(
    source,
    /prefetchQuery|getDay\(\)|setDate\([^\n]*(?:14|21)/,
    `${name} no debe reintroducir precargas o buffers amplios dependientes de la zona local`,
  );
}

for (const [name, source] of [
  ['useOptimizedTasks', optimizedTasksSource],
  ['useCalendarData', calendarDataSource],
]) {
  assert.match(
    source,
    /getTaskWindowRange/,
    `${name} debe limitar la agenda de limpiadora a fecha seleccionada y mañana`,
  );
}

assert.match(
  taskStorageSource,
  /getTasksForCleaner\(\s*options\.cleanerId,[\s\S]{0,250}options\.dateFrom,[\s\S]{0,100}options\.dateTo/,
  'El almacenamiento debe trasladar el rango visible a la consulta de limpiadora',
);
assert.match(
  taskStorageSource,
  /getTasksForCleaner[\s\S]*?dateFrom\?: string[\s\S]*?dateTo\?: string[\s\S]*?\.gte\('date', dateFrom\)[\s\S]*?\.lte\('date', dateTo\)/,
  'Las consultas canónica y legacy de limpiadora deben tener límite inicial y final',
);
assert.match(
  taskStorageSource,
  /if\s*\(assignErr\)[\s\S]{0,160}throw\s+assignErr/,
  'La agenda debe fallar cerrada si no puede cargar las asignaciones canónicas completas',
);
assert.match(
  taskStorageSource,
  /task\.task_assignments\s*=\s*byTask\.get\(id\)\s*\|\|\s*\[\]/,
  'Cada fila debe recibir la colección canónica completa, aunque esté vacía',
);
assert.match(
  taskStorageSource,
  /applyAssignmentCounts\(taskMap,\s*\{\s*required:\s*true\s*\}\)/,
  'El fallback legacy debe exigir el conteo canónico privilegiado para no confundir RLS con ausencia de asignaciones',
);
assert.match(
  taskStorageSource,
  /canCleanerAccessTaskByAssignments\(\{[\s\S]{0,220}visibleCanonicalCleanerIds:\s*canonicalCleanerIds[\s\S]{0,160}canonicalAssignmentCount[\s\S]{0,160}legacyCleanerId:\s*task\.cleaner_id/,
  'El almacenamiento debe decidir el fallback con conteo canónico y filas visibles, no solo cleaner_id',
);
assert.match(
  optimizedTasksSource,
  /isTaskAssignedToCleaner/,
  'El hook de limpiadora debe revalidar la pertenencia canónica antes de mostrar una tarea',
);

assert.match(
  cleaningCalendarSource,
  /getTaskWindowRange/,
  'La presentación de limpiadora debe filtrar hoy y mañana con el rango civil compartido',
);
assert.doesNotMatch(
  cleaningCalendarSource,
  /tomorrowDate[\s\S]{0,160}setDate/,
  'La presentación de limpiadora no debe recalcular mañana en la zona local',
);
assert.match(
  cleaningCalendarSource,
  /getTaskAssignedCleanerIds/,
  'Los filtros y columnas deben reconocer también a las limpiadoras canónicas secundarias',
);
assert.doesNotMatch(
  cleaningCalendarSource,
  /filteredTasks\.map\(t\s*=>\s*t\.cleanerId\)/,
  'La lista de limpiadoras con tareas no debe reducir cada tarea a su cleanerId espejo',
);

console.log('Task loading hook contract test passed');
