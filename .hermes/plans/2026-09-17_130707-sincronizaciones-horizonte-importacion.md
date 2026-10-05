# Plan — Horizonte de importación en las sincronizaciones (Avantio, Little Hotelier, Avirato)

Fecha: 2026-09-17
Repo: `C:/Users/danig/workspace/limpatexengineer/hostaway-central` (rama de trabajo propuesta: `feature/sync-horizons`)

## Goal

Hacer **configurable y más largo** el horizonte de días hacia el futuro con el que cada sincronización importa reservas y crea tareas, sin tocar los cron jobs existentes de Little Hotelier.

---

## Respuesta a la pregunta: ¿a cuántos días vista importan hoy?

| Integración | Ventana de lectura de reservas | Horizonte de creación de tareas | Dónde vive el número |
|---|---|---|---|
| **Avantio** | hoy − 1 → **hoy + 30** (dos consultas: por checkouts y por entradas) | checkout dentro de **hoy + 30** | `supabase/functions/avantio-sync/avantio-api.ts:6` (`FUTURE_DAYS = 30`, usado en `:231`) y `supabase/functions/avantio-sync/reservation-validator.ts:3` (`TASK_CREATION_HORIZON_DAYS = 30`, usado en `:39`) |
| **Little Hotelier** | hoy − 7 → **hoy + 30** | checkout + una tarea «stay» por noche, para todo lo que entra en la ventana | runner local `C:\Users\danig\Documents\little hotelier-20260627T102523Z-3-001\little hotelier\files\little_hotelier_sync.py`, líneas **76-77** (`DAYS_BACK=7`, `DAYS_AHEAD=30`), aplicadas en `_date_range()` `:1059-1063` |
| **Avirato** | hoy − 7 → **hoy + 180** | checkout + una tarea «stay» por noche, para todo lo que entra en la ventana | `supabase/functions/avirato-sync/index.ts:297-298` (`addDays(today, -7)` / `addDays(today, 180)`) |

Notas verificadas (lectura de código, sin ejecutar nada):

- **Avantio** ya separa dos conceptos: la *ventana de lectura* (`FUTURE_DAYS`) y el *horizonte de creación de tareas* (`TASK_CREATION_HORIZON_DAYS`). Una reserva con llegada dentro de 30 días se guarda aunque su checkout caiga fuera del horizonte; la tarea de limpieza solo se crea si el checkout está dentro de los 30 días (`reservation-validator.ts:30-42`).
- El cron de **Avantio** (`supabase/functions/manage-avantio-cron/index.ts:86-106`) construye los jobs desde la tabla `avantio_sync_schedules` (hora/minuto/timezone) y **no** envía ninguna ventana en el body: los 30 días son la constante del código.
- El cron de **Avirato** (`supabase/functions/manage-avirato-cron/index.ts:83-103`) tampoco envía ventana: usa el default de 180 días. La página `src/pages/AviratoAdmin.tsx:193-201` sí permite fijar `startDate`/`endDate` en ejecuciones manuales (`mode: test | preview | sync`).
- **Little Hotelier no tiene horizonte en el servidor**: `supabase/functions/little-hotelier-sync/index.ts` procesa una reserva por POST y no filtra por fecha. El horizonte lo decide el runner local, que **ya lee variables de entorno** (`DAYS_AHEAD`), y cuyo cron (perfil Hermes `limpatexlittlehotelier`, job `43c0cc0d4de9`, `little_hotelier_cron_runner.py`, 09:00/14:00/20:00) **no** inyecta `DAYS_AHEAD`.
- `load_dotenv()` se ejecuta en `little_hotelier_sync.py:47`, **antes** de leer `DAYS_AHEAD` en la línea 77 → poner `DAYS_AHEAD=90` en el `.env` del runner sí tiene efecto.
- No existe ningún recorte aguas abajo: `src/services/storage/taskCleanupService.ts` es un borrado manual «todas las tareas» y `supabase/functions/process-recurring-tasks` trabaja sobre tareas recurrentes, no por horizonte. Es decir, **si se amplía la ventana, las tareas futuras aparecerán de verdad** en la app y en la previsión.

---

## Contexto y supuestos

- **Little Hotelier se configura sin código**: basta `DAYS_AHEAD` en el `.env` del runner. **No se deben modificar sus cron jobs** (regla vigente). El `.env` lo edita Dani a mano; Hermes no lo lee ni lo escribe (contiene secretos).
- **Avantio y Avirato** requieren cambio de código + redeploy de la Edge Function y, para poder ajustar el horizonte sin volver a desplegar, el valor se lee de un **secret** de Supabase.
- Los números actuales se mantienen como **valores por defecto**: si el secret no existe o es inválido, el comportamiento es exactamente el de hoy (Avantio 30, Avirato 180).
- Todo cambio en producción (secrets, `functions deploy`, ejecución manual de una sincronización) **requiere autorización explícita y actual de Dani**. Desplegar no es «arreglar»: es publicar.
- El arnés de tests del repo para Edge Functions usa el patrón `<nombre>.entry.ts` + `<nombre>.mjs` con `esbuild` (ver `scripts/avantioTimeoutResilienceTest.mjs:1-24`).
- Aviso: en los tests con Node, `Deno` **no existe**; por eso el helper de entorno debe tolerar `typeof Deno === 'undefined'` y las constantes no pueden resolverse a nivel de módulo.

---

## Arquitectura / enfoque propuesto

Un único helper compartido `supabase/functions/_shared/syncHorizon.ts` resuelve «días hacia adelante» desde una variable de entorno con validación y valor por defecto; Avantio lo usa para su ventana de lectura y para su horizonte de tareas, y Avirato para su `endDate`. Little Hotelier queda **sin cambios de código**: solo se ajusta `DAYS_AHEAD` en su `.env` local.

---

## Tareas paso a paso

### Tarea 0 — Fijar los valores objetivo (decisión de Dani)

Elegir y anotar en el plan/continuidad:

| Variable | Integración | Actual | Propuesto (recomendado) |
|---|---|---|---|
| `AVANTIO_FUTURE_DAYS` | Avantio, ventana de lectura | 30 | **90** |
| `AVANTIO_TASK_CREATION_HORIZON_DAYS` | Avantio, creación de tarea de limpieza | 30 | **45** (las tareas a 90 días suelen cambiar) |
| `DAYS_AHEAD` (env del runner) | Little Hotelier | 30 | **90** |
| `AVIRATO_FUTURE_DAYS` | Avirato | 180 | **180** (ya es el más largo; solo se hace configurable) |

Si Dani no elige, **no se despliega nada**: el código queda preparado con los defaults actuales.

---

### Tarea 1 — Helper compartido + test que falla (TDD)

**1.1** Crear el test (debe fallar antes de existir el helper).

`scripts/syncHorizonTest.entry.ts`:

```ts
import { resolveDaysAhead } from '../supabase/functions/_shared/syncHorizon.ts';

type Assert = typeof import('node:assert/strict');

export const run = async (assert: Assert) => {
  assert.equal(resolveDaysAhead('90', 30), 90, 'lee un entero positivo');
  assert.equal(resolveDaysAhead(undefined, 30), 30, 'sin valor usa el default');
  assert.equal(resolveDaysAhead('', 30), 30, 'cadena vacía usa el default');
  assert.equal(resolveDaysAhead('abc', 30), 30, 'no numérico usa el default');
  assert.equal(resolveDaysAhead('0', 30), 30, 'cero usa el default');
  assert.equal(resolveDaysAhead('-5', 30), 30, 'negativo usa el default');
  assert.equal(resolveDaysAhead(' 45 ', 30), 45, 'tolera espacios');
  assert.equal(resolveDaysAhead('30.9', 30), 30, 'no acepta decimales raros: 30 es válido, pero nunca 30.9');

  console.log('sync-horizon-tests: OK');
};
```

`scripts/syncHorizonTest.mjs` (mismo patrón que `avantioTimeoutResilienceTest.mjs`):

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

Añadir a `package.json` (orden alfabético junto a las otras `test:*`):

```json
"test:sync-horizon": "node scripts/syncHorizonTest.mjs",
```

Ejecutar — **debe fallar** (aún no existe el helper):

```bash
cd C:/Users/danig/workspace/limpatexengineer/hostaway-central
npm run test:sync-horizon
```

Salida esperada: error de esbuild tipo `Could not resolve "../supabase/functions/_shared/syncHorizon.ts"` y `exit code 1`.

**1.2** Crear `supabase/functions/_shared/syncHorizon.ts`:

```ts
/**
 * Horizonte (días hacia el futuro) que una sincronización usa para leer
 * reservas y para decidir si crea tareas.
 *
 * Se resuelve por variable de entorno para poder ajustarlo sin tocar código.
 * Cualquier valor que no sea un entero positivo cae al valor por defecto
 * histórico, de modo que un secret mal escrito nunca amplía ni recorta el
 * comportamiento por accidente.
 */
export function resolveDaysAhead(raw: string | undefined | null, fallback: number): number {
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Lee un secret/variable de entorno sin romper en Node (tests con esbuild). */
export function envValue(name: string): string | undefined {
  if (typeof Deno === 'undefined') return undefined;
  return Deno.env.get(name) ?? undefined;
}
```

**1.3** Ejecutar de nuevo — ahora **debe pasar**:

```bash
npm run test:sync-horizon
```

Salida esperada: `sync-horizon-tests: OK` y `exit code 0`.

Nota: la aserción `'30.9'` documenta que `parseInt` devuelve 30 para `"30.9"`; si se prefiere rechazar decimales, cambiar el helper a `Number(raw)` + `Number.isInteger` **y** actualizar el test primero.

**1.4** Commit:

```bash
git add supabase/functions/_shared/syncHorizon.ts scripts/syncHorizonTest.* package.json
git commit -m "test: add configurable sync horizon helper"
```

---

### Tarea 2 — Avantio: ventana de lectura configurable

**2.1** Test que falla. Añadir al final de `scripts/syncHorizonTest.entry.ts` (importando además el API de Avantio):

```ts
import { avantioFutureDays, fetchAllAvantioReservations } from '../supabase/functions/avantio-sync/avantio-api.ts';
```

```ts
  // La ventana de lectura debe usar el horizonte resuelto.
  const urls: string[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ data: [], meta: { totalPages: 1, page: 1 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  await fetchAllAvantioReservations('token-de-prueba', { fetchImpl: fakeFetch, futureDays: 90 });
  assert.ok(urls.length >= 1, 'debe consultar la API de Avantio');
  assert.ok(
    urls.every((u) => u.includes('departureTo=') || u.includes('arrivalTo=')),
    'las ventanas usan departureTo/arrivalTo',
  );
  assert.equal(avantioFutureDays(), 30, 'sin env, el default histórico es 30');
```

Ejecutar `npm run test:sync-horizon`: debe fallar (`avantioFutureDays` no existe / `futureDays` no se acepta).

**2.2** Editar `supabase/functions/avantio-sync/avantio-api.ts`:

- Arriba del archivo, junto a `const API_BASE_URL`, sustituir `const FUTURE_DAYS = 30;` por:

```ts
import { envValue, resolveDaysAhead } from '../_shared/syncHorizon.ts';

const DEFAULT_FUTURE_DAYS = 30;
export const AVANTIO_FUTURE_DAYS_ENV = 'AVANTIO_FUTURE_DAYS';

/** Días hacia el futuro que se leen de Avantio (secret AVANTIO_FUTURE_DAYS). */
export function avantioFutureDays(): number {
  return resolveDaysAhead(envValue(AVANTIO_FUTURE_DAYS_ENV), DEFAULT_FUTURE_DAYS);
}
```

- En `AvantioFetchOptions`, añadir el campo opcional:

```ts
  /** Override del horizonte de lectura; por defecto, `avantioFutureDays()`. */
  futureDays?: number;
```

- En `fetchAllAvantioReservations`, sustituir la línea 231:

```ts
  const toDate = addDaysISO(today, options.futureDays ?? avantioFutureDays());
```

- **No tocar** `MAX_RETRIES`, `TIMEOUT_MS`, `MAX_PAGES`, `PAGE_SIZE` ni el bloque de `queryWindows` (líneas 252-255): `scripts/avantioTimeoutResilienceTest.mjs:34-46` comprueba esos patrones.

**2.3** Ejecutar y verificar:

```bash
npm run test:sync-horizon && npm run test:avantio-timeout-resilience
```

Salida esperada: `sync-horizon-tests: OK` y `avantio-timeout-resilience-tests: OK`.

**2.4** Commit: `git add supabase/functions/avantio-sync/avantio-api.ts scripts/syncHorizonTest.entry.ts && git commit -m "feat: make Avantio read window configurable"`

---

### Tarea 3 — Avantio: horizonte de creación de tareas configurable

**3.1** Test que falla. Añadir al `run()` de `scripts/syncHorizonTest.entry.ts`:

```ts
import { shouldCreateTaskForReservation, taskCreationHorizonDays } from '../supabase/functions/avantio-sync/reservation-validator.ts';
```

```ts
  const base = {
    id: 'r1',
    accommodationId: '1',
    accommodationName: 'Casa',
    accommodationInternalName: 'C1',
    status: 'CONFIRMED',
    arrivalDate: '2026-09-20',
    departureDate: '',
    guestName: 'Huésped',
  } as any;

  const inDays = (n: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  assert.equal(taskCreationHorizonDays(), 30, 'sin env, el default histórico es 30');
  assert.equal(shouldCreateTaskForReservation({ ...base, departureDate: inDays(29) }), true, 'checkout a 29 días crea tarea');
  assert.equal(shouldCreateTaskForReservation({ ...base, departureDate: inDays(60) }), false, 'checkout a 60 días no crea tarea con horizonte 30');
  assert.equal(shouldCreateTaskForReservation({ ...base, departureDate: inDays(60) }, 90), true, 'con horizonte 90 sí crea tarea');
  assert.equal(shouldCreateTaskForReservation({ ...base, status: 'CANCELLED', departureDate: inDays(10) }), false, 'cancelada nunca crea tarea');
```

Ejecutar `npm run test:sync-horizon`: debe fallar.

**3.2** Editar `supabase/functions/avantio-sync/reservation-validator.ts`:

```ts
import { AvantioReservation } from './types.ts';
import { envValue, resolveDaysAhead } from '../_shared/syncHorizon.ts';

export const DEFAULT_TASK_CREATION_HORIZON_DAYS = 30;
export const AVANTIO_TASK_HORIZON_ENV = 'AVANTIO_TASK_CREATION_HORIZON_DAYS';

/** Días hacia el futuro en los que se crea tarea de limpieza. */
export function taskCreationHorizonDays(): number {
  return resolveDaysAhead(envValue(AVANTIO_TASK_HORIZON_ENV), DEFAULT_TASK_CREATION_HORIZON_DAYS);
}

export function shouldCreateTaskForReservation(
  reservation: AvantioReservation,
  horizonDays: number = taskCreationHorizonDays(),
): boolean {
  // ...cuerpo actual sin cambios hasta la línea del cálculo...
  const lastTaskDate = new Date(today);
  lastTaskDate.setDate(lastTaskDate.getDate() + horizonDays);
  if (checkoutDate > lastTaskDate) {
    return false;
  }
  return true;
}
```

Comprobar que nadie más usa el nombre antiguo:

```bash
grep -rn "TASK_CREATION_HORIZON_DAYS" --include='*.ts' --include='*.tsx' --include='*.mjs' src scripts supabase/functions
```

Salida esperada: vacía (las apariciones en `supabase/production-snapshot/avantio-sync.json` son una foto histórica y **no** se editan).

**3.3** Verificar y commitear:

```bash
npm run test:sync-horizon && npm run test:avantio-timeout-resilience && npm run test:pms-cancellation-safety
git add supabase/functions/avantio-sync/reservation-validator.ts scripts/syncHorizonTest.entry.ts
git commit -m "feat: make Avantio task creation horizon configurable"
```

Salida esperada: `sync-horizon-tests: OK`, `avantio-timeout-resilience-tests: OK`, `pms-cancellation-safety-tests: OK`.

---

### Tarea 4 — Avirato: ventana configurable

**4.1** Test que falla (añadir al `run()` del test):

```ts
import { aviratoDateRange } from '../supabase/functions/avirato-sync/date-range.ts';
```

```ts
  const range = aviratoDateRange({ today: '2026-09-17' });
  assert.equal(range.startDate, '2026-09-10', '7 días hacia atrás por defecto');
  assert.equal(range.endDate, '2027-03-16', '180 días hacia adelante por defecto');
  const custom = aviratoDateRange({ today: '2026-09-17', futureDays: 90, body: { startDate: '2026-09-01' } });
  assert.equal(custom.startDate, '2026-09-01', 'el body manda sobre el default');
  assert.equal(custom.endDate, '2026-12-16', 'usa el horizonte indicado');
```

**4.2** Crear `supabase/functions/avirato-sync/date-range.ts` (extrae la lógica hoy embebida en `index.ts`, para poder testearla sin arrancar la función):

```ts
import { envValue, resolveDaysAhead } from '../_shared/syncHorizon.ts';

export const DEFAULT_FUTURE_DAYS = 180;
export const DEFAULT_PAST_DAYS = 7;
export const AVIRATO_FUTURE_DAYS_ENV = 'AVIRATO_FUTURE_DAYS';

export function aviratoFutureDays(): number {
  return resolveDaysAhead(envValue(AVIRATO_FUTURE_DAYS_ENV), DEFAULT_FUTURE_DAYS);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function aviratoDateRange(input: {
  today: string;
  futureDays?: number;
  body?: { startDate?: string; endDate?: string };
}): { startDate: string; endDate: string } {
  const futureDays = input.futureDays ?? aviratoFutureDays();
  return {
    startDate: input.body?.startDate || addDays(input.today, -DEFAULT_PAST_DAYS),
    endDate: input.body?.endDate || addDays(input.today, futureDays),
  };
}
```

**4.3** En `supabase/functions/avirato-sync/index.ts`, sustituir las líneas 296-298 por:

```ts
  const today = madridToday();
  const { startDate, endDate } = aviratoDateRange({ today, body });
```

y añadir el import arriba: `import { aviratoDateRange } from './date-range.ts';`
Se puede borrar la función local `addDays` de `index.ts:120-124` **solo** si ya no se usa en ese archivo (comprobar con `grep -n "addDays(" supabase/functions/avirato-sync/index.ts`); si se usa para las tareas «stay» (línea 479), dejarla.

**4.4** Verificar y commitear:

```bash
npm run test:sync-horizon
git add supabase/functions/avirato-sync/date-range.ts supabase/functions/avirato-sync/index.ts scripts/syncHorizonTest.entry.ts
git commit -m "feat: make Avirato reservation window configurable"
```

---

### Tarea 5 — Little Hotelier: solo configuración, sin tocar código ni cron

**5.1** Dani edita a mano (Hermes no lee ni escribe el `.env`) el archivo:

```
C:\Users\danig\Documents\little hotelier-20260627T102523Z-3-001\little hotelier\files\.env
```

añadiendo o cambiando la línea:

```
DAYS_AHEAD=90
```

(`DAYS_BACK=7` se deja igual.)

**5.2** Verificación **read-only** desde la carpeta del runner (no envía nada a la app):

```bash
cd "C:/Users/danig/Documents/little hotelier-20260627T102523Z-3-001/little hotelier/files"
python little_hotelier_sync.py --validate-config
python little_hotelier_sync.py --list --days 90 | head -5
python little_hotelier_sync.py --status
```

Salida esperada: sin errores de configuración; la lista muestra reservas con fechas de hasta +90 días; `--status` informa del último run.

**5.3** Comprobar el efecto real tras el siguiente pase del cron (09:00, 14:00 o 20:00) leyendo el log del runner:

```bash
grep "Obteniendo reservas" "C:/Users/danig/Documents/little hotelier-20260627T102523Z-3-001/little hotelier/files/hermes_cron_sync.log" | tail -3
```

Salida esperada: la ventana mostrada termina ~90 días después de hoy. **No** se modifica `jobs.json` ni el job `43c0cc0d4de9`.

---

### Tarea 6 — Puertas de calidad locales

```bash
cd C:/Users/danig/workspace/limpatexengineer/hostaway-central
npm run test:sync-horizon
npm run test:avantio-timeout-resilience
npm run test:worker-maintenance-conflict
npm run test:worker-task-overlap
npx eslint supabase/functions/_shared/syncHorizon.ts supabase/functions/avantio-sync supabase/functions/avirato-sync scripts/syncHorizonTest.mjs
git diff --check
```

Salida esperada: todos los tests `OK`, eslint sin salida y `exit 0`, `git diff --check` sin salida.
Typecheck global: `npm run typecheck` — **puede fallar por deuda preexistente**; comparar el número de errores antes y después y exigir que no aumente.

---

### Tarea 7 — Publicación (solo con autorización explícita de Dani)

**7.1** Fijar los horizontes como secretos:

```bash
npx supabase secrets set AVANTIO_FUTURE_DAYS=90 AVANTIO_TASK_CREATION_HORIZON_DAYS=45
npx supabase secrets list
```

Salida esperada: los dos nombres aparecen en la lista (los valores no se muestran).

**7.2** Desplegar las dos funciones afectadas:

```bash
npx supabase functions deploy avantio-sync
npx supabase functions deploy avirato-sync
```

Salida esperada de cada una: `Deployed Function <nombre>`.

**7.3** Smoke test **sin escribir nada** (Avirato tiene modo preview):

```bash
curl -s -X POST "https://qyipyygojlfhdghnraus.supabase.co/functions/v1/avirato-sync" \
  -H 'Content-Type: application/json' -d '{"mode":"preview"}' | head -c 400
```

Salida esperada: JSON con `"preview": true` y `"range"` terminando ~180 días después de hoy (**no** demuestra el secret todavía; ver 7.4).

**7.4** Comprobar el horizonte realmente aplicado sin crear tareas: leer el log de la función tras una ejecución programada de Avantio y buscar la línea que ya imprime el código (`avantio-api.ts:260`):

```bash
npx supabase functions logs avantio-sync --tail 50 | grep -i "Ventanas Avantio"
```

Salida esperada: `📅 Ventanas Avantio: checkout <hoy-1>→<hoy+90> y entradas <hoy-1>→<hoy+90>`.
Es la única prueba de que el secret llegó a la función **sin** tocar la base de datos.

**7.5** Ejecución manual real (crea reservas y tareas → **requiere autorización explícita**): usar la página `AvantioAutomation` o `manage-avantio-cron` con `action: "sync"`, y después verificar solo-lectura:

```bash
npx supabase db query --linked --file <(echo "select min(date) as desde, max(date) as hasta, count(*) as tareas from public.tasks where date > (current_date + interval '30 days');")
```

Salida esperada: `hasta` cercano a hoy+90/45 según lo configurado (antes de este cambio, `hasta` no pasaba de ~30 días).

---

### Tarea 8 — Documentar

- `DOCUMENTACION/INTEGRACION_AVANTIO.md`: actualizar los «Rangos de sincronización» (líneas 11-13) con los nuevos horizontes y mencionar los secrets `AVANTIO_FUTURE_DAYS` y `AVANTIO_TASK_CREATION_HORIZON_DAYS`.
- `C:/Users/danig/workspace/limpatexengineer/CONTINUIDAD.md`: añadir una sección con fuente (petición de Dani), alcance, valores configurados, estado (preparado / probado local / publicado / verificado) y commits.
- Commit: `git commit -m "docs: record sync horizons"`.

---

## Tests / validación

| Qué | Comando | Salida esperada |
|---|---|---|
| Helper de horizonte (nuevo) | `npm run test:sync-horizon` | `sync-horizon-tests: OK` |
| Ventanas Avantio (existente) | `npm run test:avantio-timeout-resilience` | `avantio-timeout-resilience-tests: OK` |
| Cancelaciones PMS | `npm run test:pms-cancellation-safety` | `pms-cancellation-safety-tests: OK` |
| Regresiones recientes | `npm run test:worker-maintenance-conflict && npm run test:worker-task-overlap` | ambos `OK` |
| Estilo | `npx eslint <archivos tocados>` | sin salida, `exit 0` |
| Humo Avirato (sin escribir) | `curl ... '{"mode":"preview"}'` | `"preview": true` con rango de 180 días |
| Horizonte Avantio real | `npx supabase functions logs avantio-sync \| grep "Ventanas Avantio"` | ventana con `hoy+90` |
| Little Hotelier aplicado | `grep "Obteniendo reservas" hermes_cron_sync.log \| tail -3` | ventana a ~90 días |

Regla TDD por tarea: **escribir la aserción → ejecutar y ver el fallo → implementar → ejecutar y ver el verde → commit**. Un test verde no demuestra permisos ni comportamiento en producción; para eso están los pasos 7.3-7.5 y la comprobación en el log.

---

## Riesgos, tradeoffs y preguntas abiertas

**Riesgos**

1. **Más páginas en Avantio.** `MAX_PAGES=100`, `PAGE_SIZE=200`, `TIMEOUT_MS=30000`, `MAX_RETRIES=4` y el presupuesto de fetch de 70 s (`sync-orchestrator.ts`, `SOURCE_FETCH_BUDGET_MS = 70000`) están calibrados para una ventana de 30 días. Con 90 días hay ~3× reservas: medir con el smoke (7.4) y, si se agota el presupuesto, subir el presupuesto **o** reducir el horizonte de tareas (que es lo que más crece).
2. **Multiplicación de tareas «stay».** Avirato y Little Hotelier crean **una tarea por noche** dentro de la ventana. Con 90 días pasan de ~30 a ~90 tareas nocturnas por reserva larga. Afecta a la previsión y a la carga de planificación.
3. **Secretos y despliegues son producción.** `functions deploy` y `secrets set` publican de inmediato; requieren autorización explícita y actual de Dani.
4. **Little Hotelier depende de una cookie/MFA** (ver `docs/TRASPASO_HERMES.md` y el propio runner): si la sesión caduca, el lanzamiento del sync falla con independencia del horizonte. Sin cambios en sus cron jobs.
5. **Typecheck global** ya falla por deuda preexistente: no usar `npm run typecheck` como criterio único.

**Tradeoffs**

- Configurar por secret evita redeploys al ajustar, pero el valor deja de estar en el repositorio: hay que documentarlo (Tarea 8) para que no se convierta en un número invisible.
- Extraer `date-range.ts` en Avirato es un refactor pequeño y justificado por testabilidad; no tocar nada más de ese archivo.

**Preguntas abiertas (decidir antes de desplegar)**

1. ¿Qué horizontes quiere Dani: 90/90/180 (recomendado) u otros?
2. ¿Se acepta que Little Hotelier y Avirato sigan creando **una tarea por noche** en todo el horizonte, o se limita la creación «stay» a 30-45 días y se leen reservas a 90-180 (recomendado si la previsión se satura)?
3. ¿Autoriza Dani `secrets set` + `functions deploy` + una ejecución manual real de Avantio?
4. ¿Quién edita el `.env` de Little Hotelier y cuándo? (Hermes no lo toca; no se modifican sus cron jobs en ningún caso.)
