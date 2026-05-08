## Objetivo

En el calendario de administrador, al arrastrar una tarea sobre un horario donde ya hay otra(s) asignada(s) a la misma trabajadora, la nueva se coloca ahí y las que se solapan se desplazan automáticamente hacia adelante. La trabajadora recibe **un único email** notificando todos los cambios de horario aplicados en la operación.

## Comportamiento al soltar (drag & drop)

- Sueltas la tarea A en `cleanerId` + `timeSlot` → A se asigna ahí con su duración original.
- Para esa trabajadora, ese mismo día, recorrer las tareas existentes ordenadas por `startTime`:
  - Si una tarea B empieza antes del fin de la tarea anterior en cascada (arrancando con A), se desplaza: `newStart = cursorEnd`, `newEnd = newStart + duración(B)`. Cursor avanza a `newEnd`.
  - Si B empieza igual o después del cursor, se detiene la cascada (las posteriores no se tocan).
- Tareas anteriores al horario de A: **no se tocan**.
- Si algún desplazamiento llevaría más allá de las 23:59 → abortar toda la operación con toast de error (sin cambios parciales).
- Validaciones existentes (ausencias, día libre, mantenimiento, disponibilidad) siguen aplicándose para A. Para los desplazamientos en cadena no se vuelve a pedir confirmación (es la intención del admin).
- Se elimina el `confirm()` actual de "tareas apiladas" cuando el solape es solo con tareas de la misma trabajadora (ahora se resuelve desplazando).

## Notificación por email a la trabajadora

Una sola operación de drop puede mover varias tareas. En lugar de disparar un email por cada `update`, se envía **un email consolidado** a la trabajadora afectada cuando hay 1 o más desplazamientos.

### Nueva edge function: `send-task-reschedule-batch-email`

- Input:
  ```ts
  {
    cleanerEmail: string,
    cleanerName: string,
    date: string, // yyyy-MM-dd
    changes: Array<{
      taskId: string,
      property: string,
      address?: string,
      type?: string,
      oldStartTime: string,
      oldEndTime: string,
      newStartTime: string,
      newEndTime: string,
    }>
  }
  ```
- Asunto: `🔄 Reorganización de tu horario – {fecha}`
- Cuerpo: saludo personalizado + tabla con cada tarea (Propiedad | Antes | Ahora) + nota explicando que se ha insertado/movido una tarea y se han recolocado las siguientes en cadena.
- Estilo y plantilla HTML siguiendo el patrón de las otras funciones de email del proyecto (ver `send-task-schedule-change-email/index.ts`).
- CORS estándar, manejo de errores con log.
- Despliegue automático tras crearla (regla del proyecto: edge functions se despliegan al editarlas).

### Cuándo se dispara

Solo se envía cuando la operación produce ≥1 desplazamiento de tareas existentes. Si A simplemente se asigna a un hueco vacío (sin desplazar a nadie), se mantiene el flujo actual (`send-task-assignment-email` para A).

Para la propia tarea A se sigue usando el flujo existente:
- Si A pasaba de "sin asignar" → asignada: `send-task-assignment-email`.
- Si A ya estaba asignada y solo cambia horario/trabajadora: `send-task-schedule-change-email` (comportamiento actual).

El email batch añade **información sobre las tareas desplazadas**, que hoy no recibe ningún aviso.

## Detalles técnicos

Archivo principal: `src/hooks/useCalendarLogic.ts`, función `handleTaskAssign` (línea ~70).

1. Calcular `startTime`/`endTime` de A (ya existe).
2. Antes del bloque actual de `detectTaskOverlaps` + `confirm()`:
   - Filtrar tareas `task.date === A.date` y `cleanerId === destino`, excluir A.
   - Ordenar por `startTime`.
   - Construir lista `displaced[]` con cascada: para cada B, si `B.startMin < cursorEnd` → calcular `newStart`, `newEnd`, push y avanzar cursor; si no, break.
   - Si algún `newEnd > 23:59` → toast de error y `return`.
3. Aplicar updates en BD:
   - Asignación de A vía el flujo existente (`assign + reschedule` de la línea ~260).
   - `Promise.all` con `update` de cada B (solo `start_time`, `end_time`) sobre `tasks` (Madrid time, sin tocar `cleaner_id`).
4. Construir `changes[]` con datos de cada B (propiedad, dirección, antes/después) y llamar a `send-task-reschedule-batch-email` (fire-and-forget con `try/catch`, sin bloquear UI).
5. Mostrar toast: `Tarea asignada. N tarea(s) desplazada(s) automáticamente.`

### Helpers
- Reutilizar `timeToMinutes` de `src/utils/taskPositioning.ts`. Añadir `minutesToTime` local si no existe.
- Email del cleaner: obtener desde la lista `cleaners` ya cargada (mismo patrón que `taskAssignmentService`).

## Fuera de alcance

- Compactar huecos de tareas anteriores.
- Swap directo (intercambio de horarios).
- Cambios en vista mobile / vista de trabajadora.
- Avisos por email a la trabajadora original cuando A se mueve entre trabajadoras (ya cubierto por flujos existentes).
