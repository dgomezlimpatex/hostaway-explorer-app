

## Diagnóstico del problema

Cuando arrastras una tarea sin asignar a una trabajadora, se ejecuta esta cadena en `handleTaskAssign` ANTES de mostrar la tarea en su nueva posición:

1. **3 consultas a Supabase en serie** (bloqueantes):
   - `worker_fixed_days_off` (día libre fijo)
   - `worker_absences` (ausencias)
   - `worker_maintenance_cleanings` (mantenimientos)
2. Detección de overlaps + chequeo de availability
3. **`updateTask` esperado con `await`** (cambia hora) → escribe en BD + emite email de cambio de horario
4. **`assignTask` esperado con `await`** → escribe en BD + emite email de asignación
5. Recién entonces el cache se actualiza optimistamente

Además, el `assignTaskMutation.mutate` se llama dos veces (update + assign) lo que duplica round-trips de red, invalidaciones y refetch agresivos (`refetchQueries` de TODAS las queries de tasks).

**Resultado**: 3-7 segundos de espera visible antes de que la tarea “salte” a su sitio.

## Solución (sin cambiar funcionalidad)

### 1. Optimistic UI inmediato al soltar
Antes de cualquier validación o llamada a BD, aplicar un `setQueryData` optimista en React Query con la nueva `cleanerId/cleaner/startTime/endTime`. La tarea aparece **al instante** en su nueva posición. Si algo falla después, se revierte.

### 2. Validaciones en paralelo (no en serie)
Las 3 consultas a Supabase (`fixed_days_off`, `absences`, `maintenance_cleanings`) se lanzan con `Promise.all` en lugar de `await` secuencial → de ~600ms a ~200ms.

### 3. Validaciones desde caché cuando sea posible
- Las **ausencias** y **días libres fijos** ya están cargados por `useWorkersAbsenceStatus` y `useUnavailableCleaners` en el calendario. Reutilizar esos datos vía React Query cache (`queryClient.getQueryData`) en vez de re-consultar BD en cada drop.
- Solo consultar `worker_maintenance_cleanings` si no está cacheado (precargarlo al montar el calendario).

### 4. Fusionar `updateTask + assignTask` en una sola operación
Crear una nueva mutación `assignTaskWithSchedule` que haga **un único UPDATE** a la tabla `tasks` con `cleaner_id`, `cleaner`, `start_time`, `end_time` en una sola llamada. Esto:
- Reduce 2 round-trips → 1
- Una sola invalidación de cache
- Un solo email (envío en background, no bloqueante para la UI)

### 5. Email en background (fire-and-forget)
El envío de email vía Edge Function se dispara con `.then()` sin `await` desde el cliente. La UI no espera al email. Si falla, log silencioso (no toast de error porque la asignación sí funcionó).

### 6. Eliminar `refetchQueries` agresivo
En `assignTaskMutation.onSuccess` actualmente hace `invalidateQueries` + `refetchQueries` de TODAS las queries `['tasks', ...]`. Eso provoca un refetch pesado justo después del optimistic update. Cambiarlo por una invalidación silenciosa (`invalidateQueries` con `refetchType: 'none'`) y dejar que el siguiente render natural recoja los datos.

## Archivos a modificar

1. **`src/hooks/useCalendarLogic.ts`** — `handleTaskAssign`:
   - Validaciones en paralelo con `Promise.all`.
   - Reutilizar caché de ausencias/días fijos.
   - Llamar a la nueva mutación combinada en lugar de `updateTask` + `assignTask`.
   - Optimistic update inmediato al inicio.

2. **`src/hooks/useTasks.ts`**:
   - Añadir mutación `assignTaskWithScheduleMutation` que combine update de horario + asignación en un solo UPDATE.
   - Dejar de hacer `refetchQueries` agresivo en `assignTaskMutation.onSuccess` (cambiar a invalidación silenciosa).

3. **`src/services/storage/taskAssignmentService.ts`**:
   - Nuevo método `assignTaskWithSchedule(taskId, cleanerName, cleanerId, startTime, endTime)` que hace un único UPDATE.
   - Email enviado en background sin `await`.

## Resultado esperado

- **Drop visual instantáneo** (<50ms) gracias al optimistic update.
- **Confirmación con BD en ~300-500ms** en lugar de 3-7s.
- **Sin cambios funcionales**: validaciones de absences, fixed days off, maintenance, overlaps y disponibilidad siguen aplicándose con los mismos prompts de confirmación.
- **Emails siguen enviándose** pero sin bloquear la UI.

