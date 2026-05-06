## Diagnóstico

Entre las 00:00 y las ~02:00 hora de Madrid, la fecha en UTC todavía corresponde al **día anterior** (porque Madrid va UTC+1/+2). Varios sitios del código calculan "hoy" con `new Date().toISOString().split('T')[0]`, lo que devuelve la fecha **en UTC**, no en Madrid. Esto provoca dos problemas en esa franja:

1. **`src/hooks/useCalendarNavigation.ts` (`getMadridDate`)**  
   Usa `new Date(now.toLocaleString("en-US", {timeZone:"Europe/Madrid"}))`. Esta construcción es frágil: el string que devuelve `toLocaleString` se vuelve a parsear en la zona horaria **local del navegador**, no en Madrid. En equipos/navegadores cuya TZ no coincide con Madrid (o con DST recién cambiado), `currentDate` queda apuntando a un momento incorrecto y `formatMadridDate(currentDate)` devuelve un día equivocado → el filtro `task.date === currentDateStr` no encuentra nada y la vista se vacía.

2. **`src/services/storage/taskStorage.ts` línea 83 (`getTasksForCleaner`)** y **`src/hooks/useTasks.ts` líneas 47, 81, 96**  
   Calculan "hoy" con `toISOString` (UTC). Entre 00:00–02:00 Madrid = día anterior en UTC, por lo que las claves de caché que se invalidan corresponden a un día distinto del que realmente se está mostrando, dejando datos obsoletos en pantalla.

3. **`src/hooks/useOptimizedTasks.ts` línea 192 (prefetch)**  
   Usa también `date.toISOString().split('T')[0]` para las queryKeys de prefetch, mientras que la query principal usa `formatMadridDate`. A medianoche las claves no coinciden y se pierde el cache hit.

4. **`src/hooks/useRecurringTaskInstances.ts`**  
   `date.toISOString().split('T')[0]` al generar instancias virtuales recurrentes. En la franja crítica, el `dateStr` virtual se desplaza un día respecto a las claves del calendario.

El cron `process-recurring-tasks-daily` se ejecuta a las 06:00 UTC (08:00 Madrid), por lo que entre las 00:00 y las 08:00 Madrid las tareas recurrentes del nuevo día las debe pintar el front desde `useRecurringTaskInstances`. Si el desfase de zona horaria descrito arriba está activo, esas instancias también se "esconden".

## Cambios

### 1. `src/utils/date.ts`
Añadir un helper `getTodayMadrid(): Date` que devuelva un `Date` que, formateado con `formatMadridDate`, dé el día actual de Madrid de manera robusta (construyéndolo desde las partes Y-M-D que devuelve `Intl.DateTimeFormat` en `Europe/Madrid`, en lugar de re-parsear strings).

### 2. `src/hooks/useCalendarNavigation.ts`
Reemplazar `getMadridDate` por el nuevo `getTodayMadrid` de `@/utils/date`. Eliminar el `new Date(toLocaleString(...))` frágil. Loggear con `formatMadridDate` en lugar de `toISOString`.

### 3. `src/hooks/useTasks.ts`
Sustituir las tres ocurrencias de `new Date().toISOString().split('T')[0]` (líneas 47, 81, 96) por `formatMadridDate(new Date())`.

### 4. `src/services/storage/taskStorage.ts`
- Línea 83 (`getTasksForCleaner`): usar `formatMadridDate(new Date())`.
- Líneas 210 y 216 (defaults de `dateFrom`/`dateTo`): usar `formatMadridDate(...)` para coherencia.

### 5. `src/hooks/useOptimizedTasks.ts`
Línea 192 (prefetch queryKey): usar `formatMadridDate(date)` en vez de `date.toISOString().split('T')[0]` para que las claves coincidan con la query principal.

### 6. `src/hooks/useRecurringTaskInstances.ts`
Reemplazar `date.toISOString().split('T')[0]` por `formatMadridDate(date)` al generar `dateStr` para las instancias virtuales (y en `executedSet`).

## Resultado esperado

- A las 00:20 (o cualquier hora) el calendario seguirá mostrando las tareas del día actual de Madrid sin vaciarse.
- Las claves de caché, los rangos de fetch y las instancias virtuales recurrentes serán todas consistentes con la zona horaria `Europe/Madrid`.
- No se cambia el comportamiento durante el resto del día; solo se elimina el desfase de TZ.
