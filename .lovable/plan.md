
# Asignación múltiple: dividir horas en TODOS los puntos de la app

## Problema

Cuando una tarea con horario total (ej. BRIBES 11:00 → 23:00 = 12h) se asigna a varios trabajadores (ej. 3), cada persona debería trabajar **4h en paralelo** (todas 11:00 → 15:00). Hoy:

- **Calendario de admin**: muestra el bloque completo (11:00 → 23:00, 12h) en cada trabajador → mal.
- **Email de aviso**: muestra horarios **escalonados** (worker 1: 11–15, worker 2: 15–19, worker 3: 19–23) → mal. Deben ser todos 11–15.
- **Calendario del trabajador (móvil)**: ya divide correctamente.
- **Reporte automático**: ya divide la duración correctamente.

## Regla de negocio (definitiva)

Cuando una tarea tiene N trabajadores asignados (N > 1):
- **Mismo inicio** para todos (`startTime` de la tarea).
- **Duración por persona** = duración total / N.
- **Fin por persona** = `startTime + (duración total / N)`.
- Todos trabajan en paralelo, no escalonados.

## Cambios

### 1. Calendario de admin — mostrar bloque dividido
`src/utils/taskPositioning.ts` → `getEffectiveTaskEndTime`: si hay >1 trabajador, devolver `startTime + totalDuration / N` en lugar del `endTime` original.

`src/components/calendar/CalendarGrid.tsx` (`taskElements`): usar el `endTime` efectivo para `getTaskPositionWithOverlap`, de forma que el bloque renderizado tenga el ancho correcto (4h, no 12h). El bloque sigue siendo el mismo para todos los trabajadores asignados, simplemente más corto.

Mantener el badge "+N trabajadores" y la información de asignación múltiple.

### 2. Emails de asignación — horarios paralelos, no escalonados
`src/services/storage/multipleTaskAssignmentService.ts` → `buildTaskData`: eliminar el cálculo escalonado (`s = startMin + idx * perWorkerMin`). Para todos los trabajadores, devolver:
- `startTime`: el `startTime` original de la tarea.
- `endTime`: `startTime + perWorkerMin`.

Así el email a Vicente (y a los otros 2) mostraría 11:00 – 15:00 en lugar de 19:00 – 23:00.

### 3. Verificación
- Cleaner mobile (`CleanerTaskCard`): ya lo hace bien, no tocar.
- Reporte (`taskReportGenerator`): ya divide duración, no tocar.
- Detección de solapamientos (`detectTaskOverlaps`, `isTimeSlotOccupied`): seguirán usando `getEffectiveTaskEndTime`, así que al dividir el bloque dejarán libres los slots posteriores en el calendario del admin, lo cual es coherente (la persona realmente está libre de 15:00 en adelante).

## Fuera de alcance
- No se cambia cómo se reparte el trabajo (siempre paralelo, mismo inicio). Si más adelante quieres turnos escalonados, sería otra feature.
- No se toca la lógica de creación/edición de tareas ni la base de datos.

## Prueba
Recrear el caso BRIBES con 3 trabajadores asignados a 11:00–23:00 y verificar:
1. En el calendario admin cada trabajador muestra un bloque 11:00–15:00 (4h).
2. El email recibido por cada uno indica "Horario: 11:00 – 15:00".
3. La vista del trabajador y el reporte siguen mostrando 4h.
