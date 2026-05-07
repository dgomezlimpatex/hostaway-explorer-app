# Dividir duración entre múltiples trabajadores (solo visual en calendario)

## Comportamiento

Cuando una tarea tenga N trabajadores asignados (vía `task_assignments` o nombre con comas en `task.cleaner`), en el calendario cada fila de trabajador mostrará un bloque cuya duración es `duración_total / N`.

Ejemplo: Prioral 12h asignada a 3 personas → cada persona ve un bloque de 4h, empezando en `startTime` original.

## Alcance

- **Solo visual** en el calendario principal (gestor): no se modifica `start_time`/`end_time` en BD ni la tarea.
- Los reportes ya dividen por trabajador (ver memoria `multi-worker-assignment-reporting`), así que no se tocan.
- Las tarjetas seguirán siendo clicables y editables; el modal de edición sigue mostrando los tiempos originales de la tarea.

## Cambios técnicos

**`src/components/calendar/CalendarGrid.tsx`** (`CleanerRow.taskElements`, línea ~179):

1. Calcular el número de asignados de la tarea:
   - `assignmentsMap[task.id]?.length` si existe, o
   - número de nombres en `task.cleaner` separados por coma, o
   - `1` por defecto.
2. Si `count > 1`:
   - Calcular `originalDurationMin = toMinutes(task.endTime) - toMinutes(task.startTime)`.
   - `perWorkerMin = Math.round(originalDurationMin / count)`.
   - Calcular `displayEndTime = startMin + perWorkerMin → "HH:MM"`.
3. Pasar `task.startTime` y `displayEndTime` (en lugar de `task.endTime`) a `getTaskPositionWithOverlap` para calcular ancho/posición.
4. Pasar al `EnhancedTaskCard` una versión clonada de la tarea con `endTime` ajustado, para que el bloque muestre la franja correcta. Conservar `task.id` y demás campos para que el click/edición sigan funcionando con la tarea real.
5. Añadir un pequeño badge `÷N` (o tooltip "Dividido entre N personas: HH:MM–HH:MM por persona") para que el usuario entienda que la duración mostrada es la fracción.

**No se tocan:**
- `multipleTaskAssignmentService.ts` (sigue guardando duración total).
- BD ni edge functions.
- Reports (ya dividen).
- Calendario móvil del trabajador (ya muestra solo sus tareas; opcional aplicar misma división).

## Notas / consideraciones

- La división se hace por igual entre todos los asignados (no por slots paralelos ni secuenciales).
- Si en el futuro se desea repartir secuencialmente (cada trabajador en una franja distinta), se puede ampliar partiendo de este cambio.
- El botón de "redimensionar" (resize) en `EnhancedTaskCard` seguirá modificando la tarea real (endTime de BD); habrá que decidir si bloquearlo cuando hay >1 asignado para evitar confusión. **Sugerencia:** deshabilitar resize si `count > 1`.
