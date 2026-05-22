## Diagnóstico

La tarea recurrente **no se borra de la base de datos**. Se sigue mostrando como "instancia virtual" generada en el cliente a partir de la fila en `recurring_tasks`.

El problema está en `src/hooks/useCalendarData.ts` (líneas ~141-159), donde se filtran las instancias virtuales para no duplicar tareas reales. La clave de deduplicación actual es:

```text
propertyId + date + startTime         → oculta la recurrente
cleanerId + date + startTime          → oculta la recurrente
```

Cuando creas una **tarea nueva en la misma propiedad y mismo día** (y comparten `startTime`, p.ej. ambas a las 11:00), aunque sea para **otra trabajadora**, la clave `propertyId_date_startTime` coincide y la recurrente desaparece del calendario.

La protección real contra duplicados ya la garantiza la tabla `recurring_task_executions` (consultada en `useRecurringTaskInstances`), que registra las fechas en que el cron generó la tarea. La regla extra por `propertyId+startTime` es un fallback agresivo que provoca falsos positivos.

## Cambio propuesto

En `src/hooks/useCalendarData.ts`, endurecer la dedup para que **solo** oculte la instancia virtual cuando hay una tarea real que claramente es la materialización de esa recurrente:

- Clave nueva: `recurringTaskId + date` derivada de las notas autogeneradas (`"Generada automáticamente desde tarea recurrente: <name>"`) o, de forma más simple y robusta, exigir coincidencia de **propertyId + date + startTime + cleanerId**.
- Eliminar la clave amplia por `propertyId + date + startTime` sin cleaner.
- Eliminar también la clave amplia por `cleanerId + date + startTime` sin propiedad (también puede ocultar la recurrente si la trabajadora tiene otra tarea distinta a esa misma hora).

Resultado: dos tareas distintas en la misma propiedad y día, asignadas a trabajadoras diferentes, coexisten en el calendario. La dedup real frente al cron sigue funcionando vía `recurring_task_executions`.

## Archivo a tocar

- `src/hooks/useCalendarData.ts` — solo la lógica de construcción de `existingKeys` y el filtro de `newVirtualTasks` dentro del `useMemo` de `tasks`.

No requiere migraciones, ni cambios en edge functions, ni en otras vistas.

## Verificación

1. Crear/confirmar una tarea recurrente asignada a trabajadora A en una propiedad para hoy.
2. Crear desde el calendario una tarea nueva en esa misma propiedad y mismo día asignada a trabajadora B (con cualquier hora, incluida la misma).
3. Confirmar que ambas tarjetas siguen visibles en el calendario, cada una en su fila.
4. Verificar que cuando el cron genere la tarea recurrente real (misma `recurring_task_id` + fecha), la instancia virtual sí deja de mostrarse (sin duplicado).
