import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const migration = readFileSync(
  join(repoRoot, 'supabase/migrations/20260916110000_allow_fixed_day_off_registration_with_planning_conflicts.sql'),
  'utf8',
);
const hook = readFileSync(join(repoRoot, 'src/hooks/useWorkerFixedDaysOff.ts'), 'utf8');
const section = readFileSync(join(repoRoot, 'src/components/workers/absences/FixedDaysOffSection.tsx'), 'utf8');

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.guard_worker_fixed_day_off_planning_write/i);
assert.match(migration, /planning_lock_worker_dates/i);
assert.match(
  migration,
  /Do not reject the fixed day off because of existing assignments/i,
  'la libranza fija debe poder registrarse antes de resolver las tareas afectadas',
);
assert.doesNotMatch(
  migration,
  /RAISE EXCEPTION\s+'PLANNING_FIXED_DAY_OFF_CONFLICT'/i,
  'la guardia no debe bloquear el alta por asignaciones existentes',
);
assert.match(hook, /\.maybeSingle\(\)/, 'la comprobación de existencia debe aceptar cero filas');
assert.match(
  hook,
  /const \{ data: existing, error: existingError \}/,
  'los errores de la comprobación deben propagarse',
);
assert.match(
  section,
  /Las tareas ya asignadas se conservan; el día libre orienta la planificación automática y permite asignaciones manuales de emergencia/i,
  'la ficha debe explicar que una libranza no desasigna tareas existentes',
);

console.log('worker-fixed-days-off-planning-tests: OK');
