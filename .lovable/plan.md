

# Auto-eliminar tareas "POSIBLE" (REQUESTED) al llegar la hora del check-in

## Contexto

Las reservas con estado "REQUESTED" generan tareas con prefijo "POSIBLE -". Actualmente se quedan indefinidamente aunque nunca se confirmen. El objetivo es que, si al llegar la fecha y hora del check-in (17:00) la reserva sigue en estado "REQUESTED", se elimine la tarea asociada automáticamente.

## Que va a cambiar

Cada vez que se ejecuta la sincronización de Avantio (automática o manual), se ejecutara un paso adicional que:

1. Busca en la base de datos reservas con estado "REQUESTED" cuya fecha de llegada (arrival_date) + hora 17:00 ya haya pasado
2. Elimina la tarea asociada (si existe)
3. Actualiza la reserva para quitar el task_id (poniendolo a NULL)
4. Registra la accion en las estadisticas del sync log

## Detalles tecnicos

### Archivo: `supabase/functions/avantio-sync/sync-orchestrator.ts`

Se anadira un nuevo metodo `cleanupExpiredRequestedTasks()` que se ejecutara despues de `repairMissingTasks()` dentro de `performSync()`:

```text
performSync(token)
  |
  +-- Procesar reservas de la API
  +-- repairMissingTasks()        (existente)
  +-- cleanupExpiredRequestedTasks()  (NUEVO)
```

La logica del nuevo metodo:

1. Calcular la fecha/hora actual en timezone Europe/Madrid
2. Consultar `avantio_reservations` donde:
   - `status` = 'REQUESTED' (case insensitive)
   - `task_id` no es NULL
   - `arrival_date` + 17:00 Europe/Madrid ya paso
3. Para cada resultado:
   - Eliminar la tarea con `deleteTask(task_id)`
   - Actualizar la reserva: `task_id = NULL`
   - Registrar en `stats.tasks_cancelled_details`

### Logica de hora

Se comparara con `arrival_date` a las 17:00 hora de Madrid. Ejemplo:
- Reserva con `arrival_date = 2026-02-19` y hora actual = 19 Feb 17:01 Madrid -> se elimina la tarea
- Reserva con `arrival_date = 2026-02-19` y hora actual = 19 Feb 16:59 Madrid -> no se toca

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/avantio-sync/sync-orchestrator.ts` | Anadir metodo `cleanupExpiredRequestedTasks()` y llamarlo en `performSync()` |

### Despliegue

Se redesplegara la edge function `avantio-sync` para que el cambio entre en efecto en la proxima sincronizacion automatica.

