import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = process.cwd();
const read = (relative) => readFileSync(join(repoRoot, relative), 'utf8');

const manageCron = read('supabase/functions/manage-avantio-cron/index.ts');
const avantioIndex = read('supabase/functions/avantio-sync/index.ts');
const processor = read('supabase/functions/avantio-sync/reservation-processor.ts');
const migration = read('supabase/migrations/20260917150000_add_trimestral_schedule_fields.sql');

// El import debe ser npm: (el especificador https://esm.sh dejaba la función sin
// arrancar: WORKER_ERROR en cualquier petición, incluso OPTIONS).
assert.match(
  manageCron,
  /import \{ createClient \} from "npm:@supabase\/supabase-js@2\.50\.0";/,
  'importa el cliente con el especificador npm:',
);
assert.doesNotMatch(manageCron, /esm\.sh/, 'no debe depender de esm.sh para arrancar');

// El alta de horarios debe traducir días de la semana y horizonte al job.
assert.match(
  manageCron,
  /const daysOfWeek = typeof schedule\.days_of_week === 'string' \? schedule\.days_of_week\.trim\(\) : ''/,
  'lee days_of_week del horario',
);
assert.match(
  manageCron,
  /const cronSchedule = `\$\{schedule\.minute\} \$\{schedule\.hour\} \* \* \$\{daysOfWeek \|\| '\*'\}`/,
  'construye la expresión cron con día de semana',
);
assert.doesNotMatch(
  manageCron,
  /const cronSchedule = `\$\{schedule\.minute\} \$\{schedule\.hour\} \* \* \*`/,
  'no queda la expresión diaria anterior',
);
assert.match(
  manageCron,
  /Number\.isInteger\(schedule\.days_ahead\) \? \{ daysAhead: schedule\.days_ahead \} : \{\}/,
  'propaga daysAhead en el body',
);
assert.match(
  manageCron,
  /Number\.isInteger\(schedule\.task_horizon_days\) \? \{ taskHorizonDays: schedule\.task_horizon_days \} : \{\}/,
  'propaga taskHorizonDays en el body',
);

// La invocación debe resolver el horizonte del body y pasarlo al orquestador.
assert.match(
  avantioIndex,
  /const daysAhead = resolveDaysAhead\(triggerMeta\.daysAhead, avantioFutureDays\(\)\);/,
  'resuelve daysAhead del body',
);
assert.match(
  avantioIndex,
  /const taskHorizonDays = resolveDaysAhead\(triggerMeta\.taskHorizonDays, taskCreationHorizonDays\(\)\);/,
  'resuelve taskHorizonDays del body',
);
assert.match(
  avantioIndex,
  /new SyncOrchestrator\(supabaseUrl, supabaseServiceKey, \{ daysAhead, taskHorizonDays \}\)/,
  'pasa el horizonte al orquestador',
);
assert.match(
  avantioIndex,
  /daysAhead\?: number;\s*taskHorizonDays\?: number;/,
  'el tipo de triggerMeta admite el horizonte',
);

// TODAS las rutas del procesador que deciden crear tarea deben aplicar el
// horizonte de la invocación. Sin esto, una reserva ya existente cuyo checkout
// cae dentro del pase trimestral pero fuera de los 30 días por defecto se queda
// sin tarea (comprobado en producción el 2026-09-17).
const validatorCalls = processor.match(/shouldCreateTaskForReservation\(reservation[^)]*\)/g) || [];
assert.ok(validatorCalls.length >= 3, `el procesador valida en varias rutas, encontradas ${validatorCalls.length}`);
assert.ok(
  validatorCalls.every((call) => call.includes('this.taskHorizonDays')),
  `toda ruta debe aplicar el horizonte: ${validatorCalls.join(' | ')}`,
);

// La migración añade las columnas y el pase trimestral, y no toca Avirato.
assert.match(
  migration,
  /ALTER TABLE public\.avantio_sync_schedules[\s\S]*ADD COLUMN IF NOT EXISTS days_of_week text/,
  'añade days_of_week a los horarios de Avantio',
);
assert.match(migration, /ADD COLUMN IF NOT EXISTS days_ahead integer/, 'añade days_ahead');
assert.match(migration, /ADD COLUMN IF NOT EXISTS task_horizon_days integer/, 'añade task_horizon_days');
assert.match(
  migration,
  /'Trimestral L\/X\/V 09:00', 9, 5, 'Europe\/Madrid', true, '1,3,5', 92, 92/,
  'registra el pase trimestral L/X/V 09:05 Madrid con 92 días',
);
assert.doesNotMatch(migration, /avirato_sync_schedules/, 'este cambio no toca Avirato');

// Las dos funciones de borde implicadas deben seguir empaquetándose
// (sintaxis válida e imports resueltos) tras el cambio.
const outdir = mkdtempSync(join(tmpdir(), 'trimestral-schedule-'));
try {
  for (const entry of [
    'supabase/functions/avantio-sync/index.ts',
    'supabase/functions/manage-avantio-cron/index.ts',
  ]) {
    await build({
      entryPoints: [join(repoRoot, entry)],
      outfile: join(outdir, 'bundle.mjs'),
      bundle: true,
      platform: 'neutral',
      format: 'esm',
      external: ['npm:*'],
      logLevel: 'silent',
    });
  }
} finally {
  rmSync(outdir, { recursive: true, force: true });
}

console.log('trimestral-schedule-contract-tests: OK');
