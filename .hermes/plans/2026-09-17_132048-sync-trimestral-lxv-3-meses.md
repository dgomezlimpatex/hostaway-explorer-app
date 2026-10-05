# Plan — Sync trimestral lunes/miércoles/viernes 09:00 (3 meses vista) sin tocar las sincronizaciones actuales

Fecha: 2026-09-17
Repo: `C:/Users/danig/workspace/limpatexengineer/hostaway-central` (rama propuesta: `feature/sync-trimestral-lxv`)
Perfiles implicados: app (Supabase + Edge Functions) y perfil Hermes `limpatexlittlehotelier` (cron local de Little Hotelier).

## Goal

Añadir una ejecución nueva **lunes, miércoles y viernes a las 09:00** que lea **y cree** las tareas de los **próximos 3 meses (~92 días)** en los tres PMS, manteniendo intactas las sincronizaciones actuales y **sin cambiar la tipología de tarea** (Avantio: exactamente una tarea por check-out; Little Hotelier y Avirato: tarea de check-out + una tarea «stay» por noche, como hoy).

---

## Estado actual verificado (solo lectura)

### Cron jobs realmente activos (consulta a `cron.job`)

| Job (Postgres/pg_cron) | Expresión (UTC) | Equivalencia aproximada en Madrid |
|---|---|---|
| `avantio_sync_3bb3a27f` | `0 8 * * *` | 10:00 (verano) / 09:00 (invierno) |
| `avantio_sync_e5b6f453` | `0 13 * * *` | 15:00 / 14:00 |
| `avantio_sync_78796a24` | `0 18 * * *` | 20:00 / 19:00 |
| `avantio_sync_watchdog` | `*/15 * * * *` | cierra syncs colgadas (`close_stale_avantio_syncs`) |
| `avirato_sync_5a8aab51` | `0 7,8 * * *` | 09:00 todo el año (DST-safe) |
| `avirato_sync_eeeb20bd` | `0 12,13 * * *` | 14:00 |
| `avirato_sync_6630647f` | `0 18,19 * * *` | 20:00 |
| Hermes `43c0cc0d4de9` (perfil `limpatexlittlehotelier`) | `0 9,14,20 * * *` (hora local) | 09:00, 14:00 y 20:00 Madrid |

### Horizontes y mecánica actuales

| PMS | Ventana de lectura | Creación de tareas | Dónde |
|---|---|---|---|
| Avantio | hoy −1 → hoy +30 | solo si el check-out cae dentro de hoy +30 | `supabase/functions/avantio-sync/avantio-api.ts:6,231` y `reservation-validator.ts:3,39` |
| Little Hotelier | hoy −7 → hoy +30 | tarea de check-out + una por noche, sin filtro adicional | runner local `little_hotelier_sync.py:76-77` (`DAYS_BACK=7`, `DAYS_AHEAD=30`); `supabase/functions/little-hotelier-sync/index.ts` **no** filtra por fecha |
| Avirato | hoy −7 → hoy +180 | tarea de check-out + una por noche | `supabase/functions/avirato-sync/index.ts:297-298` |

Otros hechos comprobados:

- `public.avantio_sync_schedules` y `public.avirato_sync_schedules` tienen columnas `(id, name, hour, minute, timezone, is_active, created_by, created_at, updated_at)`: **no hay día de la semana ni horizonte**.
- `manage_avantio_cron_job(job_name, cron_schedule, function_url, auth_header, request_body, job_timezone)` convierte hora local→UTC con un **offset fijo de enero** (por eso en verano los jobs Avantio van 1 h antes de la hora local) y **conserva los campos de día de semana** (`parts[3:]`), así que `0 9 * * 1,3,5` es válido.
- `manage_avirato_cron_job(...)` **sí es DST-safe**: para `Europe/Madrid` expande la hora a dos valores (`9 → 7,8`), y también conserva el resto de campos.
- Los jobs se registran **desde la Edge Function** (`manage-avantio-cron` / `manage-avirato-cron`), que construye la cabecera `Authorization` con la anon key del entorno. **No hay que manejar claves a mano**: se activa llamando a la acción `setup`. En la app, `src/services/avantioSync.ts:17-23` (`setupAutomation`) ya invoca ese `setup`; para Avirato no existe llamada en el repo (se hará con `supabase functions invoke`).
- `avantio-sync` corre en modo background (202) con **guarda de concurrencia**: rechaza (409) si hay otra sincronización `running` iniciada hace menos de 30 minutos (`avantio-sync/index.ts:45-73`). Presupuestos: 110 s de trabajo, 70 s de fetch (`sync-orchestrator.ts:7-8`). `MAX_PAGES=100`, `PAGE_SIZE=200`, `TIMEOUT_MS=30000`.
- El cron de Hermes **no admite variables de entorno** en la definición del job (claves: `script`, `schedule`, `deliver`, `no_agent`, …). Por eso Little Hotelier necesita un script envoltorio.
- El runner de LH se lanza así: `python little_hotelier_sync.py` con `env.update({...})` que **no** define `DAYS_AHEAD` (`little_hotelier_cron_runner.py:70-83`), y `little_hotelier_sync.py` hace `load_dotenv()` en la línea 47 **antes** de leer `DAYS_AHEAD` en la 77: una variable de entorno del proceso gana sobre el `.env` (comportamiento por defecto de python-dotenv: no sobreescribe).
- **No modificar** el job existente de Little Hotelier (`43c0cc0d4de9`) ni su cadencia.

---

## Decisiones de diseño (y por qué)

1. **«3 meses» = 92 días** (entero configurable). Alternativa `+3 meses` naturales obliga a aritmética de meses distintos en cada PMS; 92 días es simple, testeable y suficiente.
2. **El horizonte viaja en el body de la invocación**, no en un secret global: los pases actuales (30 días Avantio/LH, 180 días Avirato) **no cambian** porque no envían ese campo. Los defaults del código siguen siendo los de hoy.
3. **`task_horizon_days` es imprescindible en Avantio**: sin él la sincronización leería reservas a 3 meses pero **no crearía** la tarea de limpieza (el validador la descarta si el check-out está a más de 30 días). Es justo lo que Dani rechaza: «no me vale que solo lean, quiero que las cree también».
4. **Minuto 5, no 0.** El pase diario de Avantio arranca a las 08:00 UTC; si el nuevo job arrancase el mismo minuto, la guarda de concurrencia (30 min) haría que uno de los dos se omitiera. Con `minute = 5` (09:05 Madrid) queda despejado sin alejarse de las 09:00 pedidas.
5. **Drift estacional de Avantio se mantiene igual que hoy** (su RPC usa offset fijo de enero): declarar 09:00 produce 09:00 en invierno y ~10:00 en verano, exactamente como los tres pases actuales. Se puede arreglar (opción B del apartado de riesgos) pero eso **cambiaría los jobs existentes**.
6. **Avirato es redundante** en esta petición: ya sincroniza 180 días cada día. El plan lo deja como tarea **opcional** para no añadir ruido; si Dani lo quiere igualmente, los pasos están escritos.
7. Little Hotelier se toca **solo con un script nuevo + un job nuevo**; su job actual y su cadencia no se modifican.

---

## Arquitectura / enfoque

Se añaden tres columnas a cada tabla de horarios (`days_of_week`, `days_ahead`, `task_horizon_days`) y una fila para el pase trimestral; `manage-*‑cron` traduce esas columnas a la expresión cron (`min hour * * <días>`) y al body (`daysAhead`, `taskHorizonDays`). `avantio-sync` y `avirato-sync` aceptan esos dos valores del body con los defaults actuales como respaldo, y Little Hotelier se resuelve con un envoltorio de 15 líneas que reutiliza su runner con `DAYS_AHEAD=92` y un job Hermes nuevo `5 9 * * 1,3,5`.

---

## Tareas paso a paso

### T1 — Migración: columnas de horario + fila del pase trimestral

Archivo nuevo: `supabase/migrations/20260917150000_add_trimestral_schedule_fields.sql`

```sql
-- Campos opcionales de horario para pases no diarios y con horizonte propio.
-- NULL en days_of_week = todos los días (comportamiento actual).
-- NULL en days_ahead / task_horizon_days = usar el default del código.
ALTER TABLE public.avantio_sync_schedules
  ADD COLUMN IF NOT EXISTS days_of_week text,
  ADD COLUMN IF NOT EXISTS days_ahead integer,
  ADD COLUMN IF NOT EXISTS task_horizon_days integer;

ALTER TABLE public.avantio_sync_schedules
  DROP CONSTRAINT IF EXISTS avantio_sync_schedules_days_of_week_check;
ALTER TABLE public.avantio_sync_schedules
  ADD CONSTRAINT avantio_sync_schedules_days_of_week_check
  CHECK (days_of_week IS NULL OR days_of_week ~ '^[0-6](,[0-6])*$');

ALTER TABLE public.avantio_sync_schedules
  DROP CONSTRAINT IF EXISTS avantio_sync_schedules_days_ahead_check;
ALTER TABLE public.avantio_sync_schedules
  ADD CONSTRAINT avantio_sync_schedules_days_ahead_check
  CHECK (days_ahead IS NULL OR days_ahead BETWEEN 1 AND 400);

ALTER TABLE public.avantio_sync_schedules
  DROP CONSTRAINT IF EXISTS avantio_sync_schedules_task_horizon_days_check;
ALTER TABLE public.avantio_sync_schedules
  ADD CONSTRAINT avantio_sync_schedules_task_horizon_days_check
  CHECK (task_horizon_days IS NULL OR task_horizon_days BETWEEN 1 AND 400);

-- Pase trimestral: lunes(1), miércoles(3), viernes(5) a las 09:05 Madrid.
INSERT INTO public.avantio_sync_schedules
  (name, hour, minute, timezone, is_active, days_of_week, days_ahead, task_horizon_days)
SELECT 'Trimestral L/X/V 09:00', 9, 5, 'Europe/Madrid', true, '1,3,5', 92, 92
WHERE NOT EXISTS (
  SELECT 1 FROM public.avantio_sync_schedules WHERE name = 'Trimestral L/X/V 09:00'
);
```

Ejecutar **solo** este archivo (no `db push` global: hay migraciones divergentes):

```bash
cd C:/Users/danig/workspace/limpatexengineer/hostaway-central
npx supabase db query --linked --file supabase/migrations/20260917150000_add_trimestral_schedule_fields.sql
npx supabase migration repair --status applied --linked 20260917150000
```

Salida esperada: `rows: []` y luego `Migration history repaired ... [20260917150000] => applied`.

Verificar (solo lectura):

```bash
npx supabase db query --linked --file C:/Users/danig/AppData/Local/Temp/verify_trimestral_schedules.sql
```

con el contenido:

```sql
select name, hour, minute, days_of_week, days_ahead, task_horizon_days, is_active
from public.avantio_sync_schedules
order by hour, minute;
```

Salida esperada: 4 filas, las 3 diarias con `days_of_week` NULL y la nueva `Trimestral L/X/V 09:00` con `1,3,5 | 92 | 92 | true`.

**Nota**: el estado actual de `avantio_sync_schedules` debe fotografiarse antes de tocar nada, para comparar después:

```sql
select name, hour, minute, is_active from public.avantio_sync_schedules order by hour;
```

Commit: `git add supabase/migrations/20260917150000_add_trimestral_schedule_fields.sql && git commit -m "feat: add non-daily schedule fields and trimestral Avantio pass"`

---

### T2 — Helper compartido de horizonte + test (TDD)

**2.1** `scripts/syncHorizonTest.entry.ts` (debe fallar primero):

```ts
import { resolveDaysAhead } from '../supabase/functions/_shared/syncHorizon.ts';

type Assert = typeof import('node:assert/strict');

export const run = async (assert: Assert) => {
  assert.equal(resolveDaysAhead('92', 30), 92, 'lee un entero positivo');
  assert.equal(resolveDaysAhead(undefined, 30), 30, 'sin valor usa el default');
  assert.equal(resolveDaysAhead('', 30), 30, 'cadena vacía usa el default');
  assert.equal(resolveDaysAhead('abc', 30), 30, 'no numérico usa el default');
  assert.equal(resolveDaysAhead('0', 30), 30, 'cero usa el default');
  assert.equal(resolveDaysAhead('-5', 30), 30, 'negativo usa el default');
  assert.equal(resolveDaysAhead(' 92 ', 30), 92, 'tolera espacios');
  console.log('sync-horizon-tests: OK');
};
```

**2.2** `scripts/syncHorizonTest.mjs`:

```js
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = process.cwd();
const outdir = mkdtempSync(join(tmpdir(), 'sync-horizon-'));
const outfile = join(outdir, 'bundle.mjs');

await build({
  entryPoints: [join(repoRoot, 'scripts/syncHorizonTest.entry.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: false,
  logLevel: 'silent',
});

try {
  const tests = await import(pathToFileURL(outfile).href);
  await tests.run(assert);
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
```

Añadir a `package.json`: `"test:sync-horizon": "node scripts/syncHorizonTest.mjs",`

Ejecutar: `npm run test:sync-horizon` → **falla** (`Could not resolve ... syncHorizon.ts`, exit 1).

**2.3** `supabase/functions/_shared/syncHorizon.ts`:

```ts
/**
 * Horizonte (días hacia el futuro) que una sincronización usa para leer
 * reservas y para decidir si crea tareas.
 *
 * Cualquier valor que no sea un entero positivo cae al valor por defecto
 * histórico: un valor mal escrito nunca amplía ni recorta el comportamiento
 * por accidente.
 */
export function resolveDaysAhead(raw: string | number | undefined | null, fallback: number): number {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw > 0 ? raw : fallback;
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
```

Ejecutar `npm run test:sync-horizon` → salida esperada `sync-horizon-tests: OK`.

Commit: `git add supabase/functions/_shared/syncHorizon.ts scripts/syncHorizonTest.* package.json && git commit -m "test: add sync horizon helper"`

---

### T3 — Avantio: horizonte por invocación (lectura **y** creación de tarea)

**3.1** Añadir aserciones al test (deben fallar) en `scripts/syncHorizonTest.entry.ts`:

```ts
import { avantioFutureDays, fetchAllAvantioReservations } from '../supabase/functions/avantio-sync/avantio-api.ts';
import { shouldCreateTaskForReservation, taskCreationHorizonDays } from '../supabase/functions/avantio-sync/reservation-validator.ts';

// dentro de run():
  const urls: string[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ data: [], meta: { totalPages: 1, page: 1 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  await fetchAllAvantioReservations('token-de-prueba', { fetchImpl: fakeFetch, futureDays: 92 });
  assert.ok(urls.length >= 2, 'consulta las dos ventanas (checkout y entradas)');
  assert.ok(urls.every((u) => u.includes('departureTo=') || u.includes('arrivalTo=')), 'usa las ventanas esperadas');
  assert.equal(avantioFutureDays(), 30, 'sin override, el default histórico es 30');
  assert.equal(taskCreationHorizonDays(), 30, 'sin override, el horizonte de tarea es 30');

  const iso = (n: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const base = {
    id: 'r1', accommodationId: '1', accommodationName: 'Casa', accommodationInternalName: 'C1',
    status: 'CONFIRMED', arrivalDate: iso(1), departureDate: '', guestName: 'Huésped',
  } as any;
  assert.equal(shouldCreateTaskForReservation({ ...base, departureDate: iso(60) }), false, 'a 60 días no crea tarea con horizonte 30');
  assert.equal(shouldCreateTaskForReservation({ ...base, departureDate: iso(60) }, 92), true, 'con horizonte 92 sí crea tarea de check-out');
```

Ejecutar `npm run test:sync-horizon` → **falla**.

**3.2** `supabase/functions/avantio-sync/avantio-api.ts`:

- Importar arriba: `import { envValue, resolveDaysAhead } from '../_shared/syncHorizon.ts';`
- Sustituir `const FUTURE_DAYS = 30;` por:

```ts
const DEFAULT_FUTURE_DAYS = 30;
export const AVANTIO_FUTURE_DAYS_ENV = 'AVANTIO_FUTURE_DAYS';

/** Días hacia el futuro que se leen de Avantio si la invocación no lo indica. */
export function avantioFutureDays(): number {
  return resolveDaysAhead(envValue(AVANTIO_FUTURE_DAYS_ENV), DEFAULT_FUTURE_DAYS);
}
```

- En `AvantioFetchOptions` añadir `futureDays?: number;`
- En `fetchAllAvantioReservations`, sustituir la línea 231 por:

```ts
  const toDate = addDaysISO(today, options.futureDays ?? avantioFutureDays());
```

**3.3** `supabase/functions/avantio-sync/reservation-validator.ts`:

```ts
import { AvantioReservation } from './types.ts';
import { envValue, resolveDaysAhead } from '../_shared/syncHorizon.ts';

export const DEFAULT_TASK_CREATION_HORIZON_DAYS = 30;
export const AVANTIO_TASK_HORIZON_ENV = 'AVANTIO_TASK_CREATION_HORIZON_DAYS';

export function taskCreationHorizonDays(): number {
  return resolveDaysAhead(envValue(AVANTIO_TASK_HORIZON_ENV), DEFAULT_TASK_CREATION_HORIZON_DAYS);
}

export function shouldCreateTaskForReservation(
  reservation: AvantioReservation,
  horizonDays: number = taskCreationHorizonDays(),
): boolean {
  // ...cuerpo actual sin cambios...
  const lastTaskDate = new Date(today);
  lastTaskDate.setDate(lastTaskDate.getDate() + horizonDays);
  if (checkoutDate > lastTaskDate) return false;
  return true;
}
```

Comprobar que el nombre antiguo no queda huérfano:

```bash
grep -rn "TASK_CREATION_HORIZON_DAYS" --include='*.ts' --include='*.tsx' --include='*.mjs' src scripts supabase/functions
```

Salida esperada: vacía (las apariciones en `supabase/production-snapshot/*.json` son fotos históricas y no se editan).

**3.4** `supabase/functions/avantio-sync/reservation-processor.ts`: propagar el horizonte hasta la decisión de crear tarea.

- Constructor: `constructor(supabaseUrl: string, supabaseServiceKey: string, private taskHorizonDays?: number)`
- En `handleNewReservation`, sustituir `const shouldCreate = shouldCreateTaskForReservation(reservation);` por:

```ts
      const shouldCreate = shouldCreateTaskForReservation(reservation, this.taskHorizonDays);
```

**3.5** `supabase/functions/avantio-sync/sync-orchestrator.ts`:

- Constructor: `constructor(supabaseUrl: string, supabaseServiceKey: string, private options: { daysAhead?: number; taskHorizonDays?: number } = {})` y crear el procesador con `new ReservationProcessor(supabaseUrl, supabaseServiceKey, options.taskHorizonDays)`.
- En `performSync`, cambiar la llamada de fetch a:

```ts
      const reservations = await fetchAllAvantioReservations(token, {
        deadlineAt: sourceDeadlineAt,
        futureDays: this.options.daysAhead,
      });
```

**3.6** **Actualizar la aserción existente** que fija esa llamada: en `scripts/avantioTimeoutResilienceTest.mjs:45` sustituir

```js
  assert.match(orchestratorSource, /fetchAllAvantioReservations\(token, \{ deadlineAt: sourceDeadlineAt \}\)/);
```

por

```js
  assert.match(orchestratorSource, /fetchAllAvantioReservations\(token, \{\s*deadlineAt: sourceDeadlineAt,\s*futureDays: this\.options\.daysAhead,?\s*\}\)/);
```

(Es un cambio de aserción consciente: la llamada cambia de forma; el resto de `scripts/avantioTimeoutResilienceTest.mjs` no se toca.)

**3.7** `supabase/functions/avantio-sync/index.ts`: leer el horizonte del body.

- Ampliar el tipo de `triggerMeta` en la línea 35 con `daysAhead?: number; taskHorizonDays?: number`.
- Tras el bloque que parsea el body, sanear y pasar al orquestador:

```ts
    const { resolveDaysAhead } = await import('../_shared/syncHorizon.ts');
    const daysAhead = resolveDaysAhead(triggerMeta.daysAhead, avantioFutureDays());
    const taskHorizonDays = resolveDaysAhead(triggerMeta.taskHorizonDays, taskCreationHorizonDays());

    const orchestrator = new SyncOrchestrator(supabaseUrl, supabaseServiceKey, { daysAhead, taskHorizonDays });
```

importando arriba `avantioFutureDays` de `./avantio-api.ts` y `taskCreationHorizonDays` de `./reservation-validator.ts` (evita el import dinámico; el dinámico solo se muestra para no reordenar imports). El body parcial del pase trimestral se registrará en `avantio_sync_logs` vía `initializeSyncLog(triggerMeta)` sin cambios.

**3.8** Verificar y commitear:

```bash
npm run test:sync-horizon && npm run test:avantio-timeout-resilience && npm run test:pms-cancellation-safety
git add supabase/functions/_shared/syncHorizon.ts supabase/functions/avantio-sync scripts/syncHorizonTest.entry.ts scripts/avantioTimeoutResilienceTest.mjs
git commit -m "feat: let Avantio sync accept a per-run horizon"
```

Salida esperada: `sync-horizon-tests: OK`, `avantio-timeout-resilience-tests: OK`, `pms-cancellation-safety-tests: OK`.

---

### T4 — `manage-avantio-cron`: día de la semana y horizonte en el body

Archivo: `supabase/functions/manage-avantio-cron/index.ts`, dentro de `setupCronJobs` (líneas 86-94). Sustituir:

```ts
  for (const schedule of schedules) {
    const cronSchedule = `${schedule.minute} ${schedule.hour} * * *`;
    const jobName = `avantio_sync_${schedule.id.substring(0, 8)}`;
    const requestBody = JSON.stringify({
      triggered_by: 'scheduled',
      schedule_id: schedule.id,
      schedule_name: schedule.name
    });
```

por:

```ts
  for (const schedule of schedules) {
    // days_of_week vacío/NULL = todos los días (comportamiento histórico).
    const daysOfWeek = typeof schedule.days_of_week === 'string' ? schedule.days_of_week.trim() : '';
    const cronSchedule = `${schedule.minute} ${schedule.hour} * * ${daysOfWeek || '*'}`;
    const jobName = `avantio_sync_${schedule.id.substring(0, 8)}`;
    const requestBody = JSON.stringify({
      triggered_by: 'scheduled',
      schedule_id: schedule.id,
      schedule_name: schedule.name,
      ...(Number.isInteger(schedule.days_ahead) ? { daysAhead: schedule.days_ahead } : {}),
      ...(Number.isInteger(schedule.task_horizon_days) ? { taskHorizonDays: schedule.task_horizon_days } : {})
    });
```

El resto de la función no se toca: el RPC `manage_avantio_cron_job` ya conserva los campos de día de semana (`parts[3:]`).

Test estático (nuevo, mismo estilo que los demás contratos): `scripts/trimestralScheduleContractTest.mjs`

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('supabase/functions/manage-avantio-cron/index.ts', 'utf8');

assert.match(source, /const cronSchedule = `\$\{schedule\.minute\} \$\{schedule\.hour\} \* \* \$\{daysOfWeek \|\| '\*'\}`/, 'el cron usa days_of_week');
assert.match(source, /Number\.isInteger\(schedule\.days_ahead\) \? \{ daysAhead: schedule\.days_ahead \}/, 'propaga daysAhead');
assert.match(source, /Number\.isInteger\(schedule\.task_horizon_days\) \? \{ taskHorizonDays: schedule\.task_horizon_days \}/, 'propaga taskHorizonDays');

const migration = readFileSync('supabase/migrations/20260917150000_add_trimestral_schedule_fields.sql', 'utf8');
assert.match(migration, /'Trimestral L\/X\/V 09:00', 9, 5, 'Europe\/Madrid', true, '1,3,5', 92, 92/, 'el pase trimestral queda registrado');

console.log('trimestral-schedule-contract-tests: OK');
```

Añadir a `package.json`: `"test:trimestral-schedule": "node scripts/trimestralScheduleContractTest.mjs",`

```bash
npm run test:trimestral-schedule
git add supabase/functions/manage-avantio-cron/index.ts scripts/trimestralScheduleContractTest.mjs package.json
git commit -m "feat: support non-daily schedules in Avantio cron setup"
```

Salida esperada: `trimestral-schedule-contract-tests: OK`.

---

### T5 — Avirato: horizonte por invocación (opcional, ver riesgos)

**5.1** Extraer la ventana a `supabase/functions/avirato-sync/date-range.ts`:

```ts
import { envValue, resolveDaysAhead } from '../_shared/syncHorizon.ts';

export const DEFAULT_FUTURE_DAYS = 180;
export const DEFAULT_PAST_DAYS = 7;
export const AVIRATO_FUTURE_DAYS_ENV = 'AVIRATO_FUTURE_DAYS';

export function aviratoFutureDays(): number {
  return resolveDaysAhead(envValue(AVIRATO_FUTURE_DAYS_ENV), DEFAULT_FUTURE_DAYS);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function aviratoDateRange(input: {
  today: string;
  futureDays?: number;
  body?: { startDate?: string; endDate?: string };
}): { startDate: string; endDate: string } {
  const futureDays = resolveDaysAhead(input.futureDays, aviratoFutureDays());
  return {
    startDate: input.body?.startDate || addDays(input.today, -DEFAULT_PAST_DAYS),
    endDate: input.body?.endDate || addDays(input.today, futureDays),
  };
}
```

**5.2** En `supabase/functions/avirato-sync/index.ts` sustituir las líneas 296-298:

```ts
  const today = madridToday();
  const { startDate, endDate } = aviratoDateRange({ today, futureDays: body.daysAhead, body });
```

y añadir `import { aviratoDateRange } from './date-range.ts';`. Eliminar la `addDays` local (líneas 120-124) solo si ya no se usa en el archivo:

```bash
grep -n "addDays(" supabase/functions/avirato-sync/index.ts
```

Test (añadir al `run()` de `scripts/syncHorizonTest.entry.ts`):

```ts
import { aviratoDateRange } from '../supabase/functions/avirato-sync/date-range.ts';
...
  assert.deepEqual(aviratoDateRange({ today: '2026-09-17' }), { startDate: '2026-09-10', endDate: '2027-03-16' }, 'default 7/180');
  assert.deepEqual(aviratoDateRange({ today: '2026-09-17', futureDays: 92 }), { startDate: '2026-09-10', endDate: '2026-12-18' }, 'horizonte 92');
  assert.deepEqual(aviratoDateRange({ today: '2026-09-17', futureDays: 92, body: { startDate: '2026-09-01' } }), { startDate: '2026-09-01', endDate: '2026-12-18' }, 'el body manda');
```

(Con `futureDays: 0` o `undefined` debe volver a 180: añadir `assert.deepEqual(aviratoDateRange({ today: '2026-09-17', futureDays: 0 }), aviratoDateRange({ today: '2026-09-17' }), '0 cae al default');`)

**5.3** `manage-avirato-cron` (`setupCronJobs`, líneas 83-94): misma transformación que en Avantio:

```ts
  for (const schedule of schedules) {
    const daysOfWeek = typeof schedule.days_of_week === 'string' ? schedule.days_of_week.trim() : '';
    const cronSchedule = `${schedule.minute} ${schedule.hour} * * ${daysOfWeek || '*'}`;
    const jobName = `avirato_sync_${schedule.id.substring(0, 8)}`;
    const requestBody = JSON.stringify({
      mode: 'sync',
      triggered_by: 'scheduled',
      schedule_id: schedule.id,
      schedule_name: schedule.name,
      scheduled_local_hour: schedule.hour,
      scheduled_local_minute: schedule.minute,
      scheduled_timezone: schedule.timezone || 'Europe/Madrid',
      ...(Number.isInteger(schedule.days_ahead) ? { daysAhead: schedule.days_ahead } : {}),
    });
```

Requiere además (si se decide activar Avirato) ampliar la migración T1 con las mismas columnas para `public.avirato_sync_schedules` y la fila:

```sql
INSERT INTO public.avirato_sync_schedules
  (name, hour, minute, timezone, is_active, days_of_week, days_ahead)
SELECT 'Trimestral L/X/V 09:00', 9, 5, 'Europe/Madrid', true, '1,3,5', 92
WHERE NOT EXISTS (
  SELECT 1 FROM public.avirato_sync_schedules WHERE name = 'Trimestral L/X/V 09:00'
);
```

```bash
npm run test:sync-horizon
git add supabase/functions/avirato-sync supabase/functions/manage-avirato-cron/index.ts scripts/syncHorizonTest.entry.ts
git commit -m "feat: support non-daily Avirato schedules with per-run horizon"
```

---

### T6 — Little Hotelier: envoltorio con 3 meses + job nuevo (no tocar el existente)

**6.1** Crear `C:/Users/danig/AppData/Local/hermes/profiles/limpatexlittlehotelier/scripts/little_hotelier_cron_runner_trimestral.py`:

```python
#!/usr/bin/env python
"""Pase trimestral de Little Hotelier: mismos pasos, 3 meses de horizonte.

Reutiliza el runner de cron existente (control de sesión, avisos y logs
idénticos) cambiando solo DAYS_AHEAD, que little_hotelier_sync.py lee del
entorno antes de leer su .env.

El job diario 09:00/14:00/20:00 NO se modifica: sigue con 30 días.
"""
from __future__ import annotations

import os
import sys

os.environ["DAYS_AHEAD"] = "92"
os.environ["DAYS_BACK"] = "7"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import little_hotelier_cron_runner as runner  # noqa: E402

if __name__ == "__main__":
    sys.exit(runner.main())
```

**6.2** Verificar el envoltorio **en seco** (no envía nada a la app) con el sincronizador real, comprobando que el rango son 92 días:

```bash
cd "C:/Users/danig/Documents/little hotelier-20260627T102523Z-3-001/little hotelier/files"
DAYS_AHEAD=92 python little_hotelier_sync.py --list --days 92 | head -5
```

Salida esperada: lista de reservas con fechas de hasta 92 días vista y, en la cabecera, el rango `hoy-7 → hoy+92`.

**6.3** Crear el job (lunes/miércoles/viernes 09:05 local, sin LLM, entregado al Bot Chat de `limpatexdev`):

```bash
"C:/Users/danig/.local/bin/limpatexlittlehotelier.bat" cron create "5 9 * * 1,3,5" \
  --name "Little Hotelier trimestral L/X/V 09:00" \
  --script little_hotelier_cron_runner_trimestral.py \
  --no-agent \
  --deliver bot-chat:limpatexdev
```

Verificar:

```bash
"C:/Users/danig/.local/bin/limpatexlittlehotelier.bat" cron list
```

Salida esperada: **dos** jobs, `0 9,14,20 * * *` (el de siempre, intacto) y `5 9 * * 1,3,5` (el nuevo), ambos `active`.

**6.4** Primer disparo manual (autorizado) y verificación del rango real en el log:

```bash
"C:/Users/danig/.local/bin/limpatexlittlehotelier.bat" cron run <id-del-job-nuevo>
sleep 120
grep "Obteniendo reservas" "C:/Users/danig/Documents/little hotelier-20260627T102523Z-3-001/little hotelier/files/hermes_cron_sync.log" | tail -2
```

Salida esperada: la línea más reciente termina ~92 días después de hoy.

---

### T7 — Activar los horarios nuevos (Edge Functions)

**Avantio** (reutiliza la llamada existente de la app, sin manejar claves): en la página de automatización de Avantio, botón de configurar automatización (`avantioSync.setupAutomation()` → `manage-avantio-cron` con `{action:'setup'}`). Alternativa por CLI:

```bash
cd C:/Users/danig/workspace/limpatexengineer/hostaway-central
npx supabase functions invoke manage-avantio-cron --body '{"action":"setup"}'
```

Salida esperada: JSON con `jobsCreated: 4` y un `details[]` con los 4 horarios (los 3 diarios + el trimestral).

**Avirato** (solo si se decide activarlo):

```bash
npx supabase functions invoke manage-avirato-cron --body '{"action":"setup"}'
```

**Verificación de que los jobs existentes NO han cambiado** (comparar con la foto tomada en T1):

```bash
npx supabase db query --linked --file C:/Users/danig/AppData/Local/Temp/verify_cron_jobs.sql
```

con:

```sql
select jobname, schedule, active from cron.job
where jobname like 'avantio_sync_%' or jobname like 'avirato_sync_%'
order by jobname;
```

Salida esperada: los tres `avantio_sync_*` con `0 8 * * *`, `0 13 * * *`, `0 18 * * *` (idénticos) y **un cuarto** con `5 8 * * 1,3,5` (declarado 09:05 Madrid; el RPC de Avantio aplica el offset fijo de enero → 08:05 UTC = 09:05 en invierno, ~10:05 en verano, igual que el resto de sus jobs).

---

### T8 — Verificación funcional (que **crea** tareas, no solo lee)

Todo con autorización explícita de Dani; son escrituras en producción.

**8.1** Disparo manual del job trimestral de Avantio:

```bash
npx supabase functions invoke avantio-sync --body '{"triggered_by":"manual","daysAhead":92,"taskHorizonDays":92}'
```

Salida esperada: HTTP 202 con `sync_log_id` (o 409 `skipped` si hay otra sync en curso: en ese caso esperar 30 min y repetir).

**8.2** Comprobar el resultado en el log de la sync (columnas reales primero):

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='avantio_sync_logs' order by ordinal_position;
```

y después:

```sql
select id, status, triggered_by, schedule_name, sync_started_at, sync_finished_at
from public.avantio_sync_logs order by sync_started_at desc limit 3;
```

Salida esperada: fila más reciente con `status='success'` (o el estado equivalente que use el esquema) y `schedule_name` coherente.

Además, en los detalles de esa sync debe verse la ventana ampliada: `avantio-api.ts:260` imprime `📅 Ventanas Avantio: checkout <hoy-1>→<hoy+92> y entradas ...`.

```bash
npx supabase functions logs avantio-sync --tail 80 | grep -i "Ventanas Avantio"
```

**8.3** Comprobar que existen tareas de limpieza más allá de los 30 días (solo lectura):

```sql
select date, count(*) as tareas
from public.tasks
where date between current_date + 31 and current_date + 95
group by 1 order by 1;
```

Salida esperada: filas con fechas a 31-95 días; antes de este cambio esa banda estaba vacía (Avantio) o solo tenía tareas de LH/Avirato.

**8.4** Tipología intacta: para Avantio, **una** tarea por check-out (ni más ni menos). Verificar sobre una reserva concreta:

```sql
select t.date, t.start_time, t.end_time, t.status
from public.tasks t
where t.date between current_date + 31 and current_date + 95
order by t.date
limit 20;
```

Salida esperada: una fila por check-out, sin tareas «stay» añadidas por Avantio.

**8.5** Idempotencia: repetir 8.1 y comprobar que el recuento de 8.3 **no** crece (los syncs hacen upsert por reserva/fecha).

---

### T9 — Documentar y cerrar

- `DOCUMENTACION/INTEGRACION_AVANTIO.md`: añadir el pase trimestral (L/X/V 09:05 Madrid, 92 días de lectura y de creación de tarea) y las columnas nuevas.
- `C:/Users/danig/workspace/limpatexengineer/CONTINUIDAD.md`: fuente (petición de Dani), alcance, valores, estado (preparado / probado local / publicado / verificado), commits y qué NO se ha tocado (job de LH, pases diarios).
- Commit: `git commit -m "docs: record trimestral sync pass"`.

---

## Tests / validación

| Qué | Comando | Salida esperada |
|---|---|---|
| Helper de horizonte | `npm run test:sync-horizon` | `sync-horizon-tests: OK` |
| Contrato del pase trimestral | `npm run test:trimestral-schedule` | `trimestral-schedule-contract-tests: OK` |
| Ventanas Avantio (existente) | `npm run test:avantio-timeout-resilience` | `avantio-timeout-resilience-tests: OK` |
| Cancelaciones PMS | `npm run test:pms-cancellation-safety` | `pms-cancellation-safety-tests: OK` |
| Estilo | `npx eslint supabase/functions/_shared/syncHorizon.ts supabase/functions/avantio-sync supabase/functions/manage-avantio-cron scripts/*.mjs` | sin salida, exit 0 |
| Whitespace | `git diff --check` | sin salida |
| Horarios registrados | `select jobname, schedule from cron.job where jobname like 'avantio_sync_%'` | 3 diarios idénticos + `5 8 * * 1,3,5` |
| Cron LH | `"...limpatexlittlehotelier.bat" cron list` | 2 jobs, el diario intacto |
| Creación real de tareas | consulta 8.3 + `sync_logs` 8.2 | tareas en la banda 31-95 días, sync `success` |

TDD por tarea: escribir aserción → ver fallo → implementar mínimo → ver verde → commit. Los tests son **estáticos** (patrones de código y SQL): no demuestran por sí solos que el pase crea tareas. La demostración real son 8.1-8.5.

---

## Riesgos, tradeoffs y preguntas abiertas

### Riesgos

1. **Presupuesto de Avantio.** Con 92 días hay ~3× reservas: `SOURCE_FETCH_BUDGET_MS = 70000` y `SYNC_WORK_BUDGET_MS = 110000` pueden quedarse cortos y la sync quedaría incompleta. Mitigación: medir en 8.2 (mira `sync_finished_at - sync_started_at` y los contadores de la sync); si se agota, subir esos presupuestos **solo en el pase trimestral** o bajar `task_horizon_days` a 60.
2. **Colisión con la guarda de concurrencia.** Por eso el pase va al minuto 5 y no al 0. Aun así, en invierno el pase de Avantio cae a las 08:05 UTC, cinco minutos después del diario de las 08:00: si el diario aún corre, el trimestral se omitirá (409). Si eso pasara, mover el minuto (p. ej. 20).
3. **Little Hotelier tiene un límite duro de ~330 s** por ejecución del runner cron (`LH_CRON_TIMEOUT_SECONDS=330`). Con 92 días hay ~3× reservas que enviar: medir el primer disparo (6.4) y, si se pasa, dividir en dos pases o subir el horizonte por tramos. La cookie/MFA también puede caducar (independiente de este cambio).
4. **Avirato es redundante** (ya lee 180 días). Crear su pase trimestral de 92 días no aporta nada y añade superficie; recomendación: **no crearlo** salvo que Dani lo pida.
5. **Un `setup` re-registra los jobs existentes** (unschedule+schedule con el mismo nombre y la misma expresión). Es idempotente, pero conviene hacerlo fuera de los minutos de arranque (08:00/13:00/18:00 UTC) y verificar después con la consulta de T7.
6. **`VITE_PLANNING_BATCH_V2_WRITE_ENABLED` y el aviso `MAINTENANCE_OVERLAP`** siguen igual: este plan no toca el planificador.
7. **Typecheck global**: `npm run typecheck` ya falla por deuda preexistente; comparar el número de errores antes/después y exigir que no aumente.

### Tradeoffs

- El horizonte en el body (no en un secret) mantiene los pases actuales intactos, a cambio de que el número viva en la fila de `*_sync_schedules` (documentado en T9).
- Avantio mantiene su drift estacional (±1 h en verano) para no alterar los jobs en producción. Arreglarlo (opción B) implicaría hacer DST-safe su RPC: los tres pases diarios pasarían a 09:00/14:00/19:00 Madrid todo el año (hoy en verano son una hora más tarde). Es una mejora, pero **cambia comportamiento existente** → decisión de Dani.
- 92 días fijos en vez de «+3 meses naturales»: simple y testeable.

### Preguntas abiertas

1. ¿Confirma Dani que el pase trimestral es **solo para Avantio y Little Hotelier** (Avirato ya llega a 180 días), o también quiere el de Avirato?
2. ¿09:05 Madrid le sirve como «09:00»? (Se elige así para no chocar con el pase diario; 09:00 exactas exigen tocar el pase diario, que no se debe modificar.)
3. ¿Autoriza la migración, el `setup` de los horarios y un disparo manual real de Avantio (escrituras en producción)?
4. ¿Quiere que se arregle el drift estacional de Avantio (opción B: RPC DST-safe), asumiendo que los tres pases diarios cambiarán de hora en verano?
5. Little Hotelier: ¿autoriza crear el job **nuevo** (el existente no se toca) y ejecutarlo una vez a mano para medir tiempos?
