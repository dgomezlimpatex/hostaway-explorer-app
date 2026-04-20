

## Plan: Optimización de edición de tareas

Tres frentes complementarios para reducir la fricción al editar tareas (fecha, hora, duración).

---

### 1. Edición inline con autosave inmediato

Eliminar el modo "Editar/Guardar/Cancelar" del modal de detalles. Los campos clave (fecha, hora inicio, duración, estado, notas, asignación) son **siempre editables** y se guardan automáticamente al salir del campo (`onBlur`).

**Cambios visuales en el modal**:
- Quitar botones "Editar / Guardar / Cancelar" del footer.
- Cada campo editable muestra indicador sutil al guardar:
  - Mientras guarda: spinner pequeño junto al campo.
  - Tras guardar: ✓ verde 1.5s y desaparece.
  - Si error: borde rojo + toast con detalle, valor revertido.
- Eliminar el toast actual "Tarea actualizada" en cada cambio (queda el indicador inline, menos ruidoso).
- Mantener confirmaciones de Eliminar y Desasignar como están.

**Comportamiento técnico**:
- Optimistic update vía `queryClient.setQueriesData` (igual que ya hicimos para drag&drop).
- Llamada a Supabase no bloqueante.
- Si cambia hora de inicio → recalcula hora fin manteniendo duración (lógica ya existente).
- Si la tarea está asignada y cambia horario/fecha, el email de notificación al limpiador se dispara en background (fire-and-forget), sin bloquear UI.

---

### 2. Campo Duración + atajos rápidos

**Nuevo input de Duración** en `TaskScheduleSection.tsx`:
- Visible junto a hora inicio/fin.
- Formato: "Xh Ymin" con stepper de 15 min (ya usado en otras partes según memoria).
- Cambiar duración → recalcula hora fin automáticamente.
- Cambiar hora fin → recalcula duración automáticamente.
- Cambiar hora inicio → mantiene duración, ajusta hora fin (lógica actual).

**Botones de atajos rápidos** debajo de los inputs de fecha/hora:

```
Fecha:  [📅 27/04/2026]  [Hoy] [Mañana] [-1 día] [+1 día]
Hora:   [11:00] → [13:45]   Duración: [2h 45min]
Atajos: [-30m] [-15m] [+15m] [+30m] [+1h]   (modifican duración)
```

- Atajos de fecha: avanzan/retroceden 1 día desde la fecha actual del campo.
- Atajos de duración: suman/restan tiempo a la duración actual.
- Cada clic dispara autosave inmediato.

---

### 3. Drag para mover y redimensionar en el calendario

En la vista calendario admin (desktop), permitir editar tareas sin abrir el modal:

**Mover en vertical** (cambiar hora):
- Ya existe drag horizontal entre limpiadoras. Añadir snap a slots de 15 min al soltar.
- Si solo cambia la hora (mismo limpiador), no se reabre el flujo de validación de asignación, solo se actualiza `start_time`/`end_time` con la misma lógica optimista.

**Redimensionar duración**:
- Añadir "handle" de 6px en el borde inferior del `EnhancedTaskCard` (cursor `ns-resize`).
- Arrastrar hacia abajo/arriba ajusta `end_time` con snap a 15 min.
- Visual: durante el drag se muestra overlay con la nueva duración ("2h 30min").
- Al soltar: optimistic update + UPDATE en Supabase (un único query).
- Si la nueva duración solapa con otra tarea del mismo limpiador, se muestra el aviso de overlap actual.

**Menú contextual (clic derecho)** sobre una tarea del calendario:
- Mover a → [Hoy / Mañana / +1 semana]
- Cambiar duración → [1h / 1h 30 / 2h / 2h 30 / 3h]
- Duplicar tarea
- Asignar a → submenu con limpiadoras
- Desasignar
- Editar detalles (abre modal completo)
- Eliminar

Implementado con `ContextMenu` de shadcn (ya disponible).

---

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `src/components/modals/TaskDetailsModal.tsx` | Quitar modo edición, autosave por campo |
| `src/components/modals/task-details/TaskDetailsActions.tsx` | Quitar botones Editar/Guardar/Cancelar |
| `src/components/modals/task-details/components/TaskScheduleSection.tsx` | Edición inline siempre activa + campo Duración + atajos |
| `src/hooks/useInlineFieldSave.ts` (nuevo) | Hook reutilizable: estado saving/saved/error + autosave con optimistic update |
| `src/components/calendar/EnhancedTaskCard.tsx` | Handle de resize inferior + ContextMenu |
| `src/components/calendar/CalendarGrid.tsx` | Snap de 15 min en drop, manejo de resize |
| `src/hooks/useCalendarLogic.ts` | Nuevo `handleTaskResize(taskId, newEndTime)` y `handleTaskReschedule(taskId, newStart)` sin reasignar |

## No se toca
- Validaciones de disponibilidad, overlaps, ausencias y mantenimientos: misma lógica.
- Vista mobile / vista cleaner: sin cambios.
- Lógica de tareas recurrentes virtuales: respeta el flujo actual de "materializar al editar".
- Permisos: cleaners siguen sin poder editar.

## Resultado esperado
- Editar fecha/hora/duración pasa de **6-7 clics** (Editar → cambiar → Guardar → cerrar) a **1-2 clics** (cambiar → click fuera, o un atajo).
- Mover tareas pequeñas en el día: arrastrar directamente, sin abrir modal.
- Cambios reflejados al instante (optimistic update <50ms) y persistidos en background.

