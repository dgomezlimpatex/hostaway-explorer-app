# Corregir días incorrectos en tareas recurrentes

## Diagnóstico

Revisé los datos en BD: la tarea recurrente **"Zonas Comunes Marina30"** está configurada con `days_of_week = [1, 3, 5]` (L, X, V) y `start_date = 2026-03-27` (Viernes — día válido). Sin embargo, las ejecuciones registradas en `recurring_task_executions` empezaron en **2026-03-29 que es DOMINGO (DOW=0)**, un día que no está en la selección.

Las siguientes ejecuciones sí cuadran (Lun 3-30, Mié 4-1, Vie 4-3, Lun 4-6, Mié 4-8…), porque la edge function `process-recurring-tasks` sí calcula bien el "siguiente" día desde el último. El problema está **únicamente en el cálculo de la PRIMERA ejecución** que hace `recurringTaskStorage.ts` al crear la tarea.

## Bugs detectados en `src/services/recurringTaskStorage.ts`

**Bug 1 — `calculateNextExecution` devuelve `startDate` sin validar el día de la semana.**
Si la fecha de inicio cae en un día que no está marcado (ej. usuario elige L/X/V pero startDate=Jueves), guarda Jueves como `next_execution` y la primera tarea se genera ese día equivocado.

**Bug 2 — Cuando `startDate <= hoy`, usa `hoy` como base e ignora `startDate`.**
Esto desplaza el cálculo y, combinado con el bug 3, produce días raros como el Domingo observado.

**Bug 3 — La rama "siguiente semana" de `calculateNextExecutionFromData` tiene aritmética incorrecta para `firstDay = 0` (Domingo).**
`daysUntilNextWeek = 7 - currentDay` aterriza ya en domingo, y luego suma `firstDay` extra. Si el primer día ordenado es 0 (Domingo seleccionado), suma 0 y queda bien; pero la lógica `firstDay === 0 ? 0 : firstDay` es frágil y rompe si el array incluye 0 mezclado con otros días (porque al ordenar `[0,3,5]`, `firstDay = 0` pero realmente queremos saltar al siguiente día válido más cercano, no a domingo de la próxima semana). Hay que reemplazar el cálculo por un bucle que avance día a día hasta encontrar uno válido (igual que ya hace la edge function), eliminando la rama "next week".

## Cambios

### 1. `src/services/recurringTaskStorage.ts`
- Reemplazar `calculateNextExecution` y la parte `case 'weekly'` de `calculateNextExecutionFromData` por una sola función robusta:
  - Calcular la fecha base = `max(startDate, hoy)`.
  - Si `frequency === 'weekly'` y hay `daysOfWeek`: avanzar día a día (hasta 14 iteraciones) hasta encontrar un día cuyo `getDay()` esté en el array. **Incluir el propio día base** si ya coincide (para no perder la primera ocurrencia cuando startDate es un día válido en el futuro).
  - Si `frequency === 'daily'`: usar `max(startDate, hoy)`.
  - Si `frequency === 'monthly'` con `dayOfMonth`: avanzar al primer mes cuyo día sea ≥ base; clamp al último día del mes si es 30/31 en meses cortos.
- Mantener el comportamiento de `endDate` (devolver `2099-12-31` si se supera).
- Usar comparaciones de fecha en formato `YYYY-MM-DD` (string) para evitar saltos por zona horaria (parseando como UTC y usando `getUTCDay()`), alineándolo con el resto del proyecto que opera en `Europe/Madrid` pero almacena fechas como `date` sin hora.

### 2. `supabase/functions/process-recurring-tasks/index.ts`
La lógica de "siguiente ejecución tras una ya hecha" ya es correcta (bucle día a día), así que **no hay que tocar la edge function**. Solo se añadirá un log adicional con el día de la semana calculado para facilitar futura depuración.

### 3. Datos existentes
Tras el fix:
- La tarea "Zonas Comunes Marina30" ya está `is_active=false`, así que no hace falta arreglar nada en BD.
- Cualquier tarea recurrente nueva que se cree usará el cálculo correcto.

## Detalles técnicos

Función nueva (resumen):

```ts
function findNextValidDate(
  base: Date,         // UTC midnight
  daysOfWeek: number[],
  inclusive: boolean  // true = incluye el día base si coincide
): Date {
  const valid = new Set(daysOfWeek);
  const d = new Date(base);
  if (inclusive && valid.has(d.getUTCDay())) return d;
  for (let i = 0; i < 14; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (valid.has(d.getUTCDay())) return d;
  }
  return d; // fallback
}
```

## Verificación

Tras el cambio, crearé mentalmente los siguientes casos contra `calculateNextExecution` y los verificaré con `console.log` puntuales si hace falta:

| startDate | hoy | days_of_week | nextExecution esperado |
|---|---|---|---|
| Vie 27-mar | Vie 27-mar | [1,3,5] | Vie 27-mar (mismo día válido) |
| Jue 26-mar | Jue 26-mar | [1,3,5] | Vie 27-mar |
| Lun 20-abr (futuro) | hoy | [3,5] | Mié 22-abr (no devolver lunes) |
| Dom selección [0] | Vie | [0] | Domingo siguiente |
| [0,3,5] | Sáb | [0,3,5] | Domingo |
