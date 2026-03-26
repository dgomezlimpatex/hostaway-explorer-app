

## Plan: Corrección del bug de eliminación de tareas compartidas entre reservas POSIBLE y CONFIRMADA

### Causa raíz

Cuando Avantio envía múltiples reservas para la misma propiedad/fecha (algunas `REQUESTED`/POSIBLE, otras `CONFIRMED`), la **deduplicación** las fusiona en una sola tarea. Pero la **limpieza de REQUESTED expiradas** encuentra esa reserva POSIBLE y elimina la tarea compartida — aunque reservas CONFIRMADAS también dependan de ella.

Resultado: la única tarea para esa propiedad/día se borra porque una de las reservas era POSIBLE.

### Dos bugs a corregir

**Bug 1: `cleanupExpiredRequestedTasks` no verifica reservas hermanas**

Antes de eliminar una tarea, debe comprobar si otra reserva no-REQUESTED comparte el mismo `task_id`. Si existen reservas confirmadas, solo debe desvincular la reserva POSIBLE — nunca borrar la tarea.

**Bug 2: `deduplicateTasks` no actualiza el nombre de la tarea**

Cuando la deduplicación fusiona tareas y la que se mantiene tiene prefijo "POSIBLE -" pero hay reservas confirmadas vinculadas, debe quitarse ese prefijo.

### Cambios necesarios

**Archivo a modificar:** `supabase/functions/avantio-sync/sync-orchestrator.ts`

**1. Método `cleanupExpiredRequestedTasks`**
- Antes de borrar una tarea de reserva REQUESTED expirada, consultar `avantio_reservations` para ver si OTRA reserva (no REQUESTED, no CANCELLED) comparte el mismo `task_id`
- Si SÍ hay hermanas: solo poner `task_id = null` en la reserva REQUESTED, NO borrar la tarea. Además quitar el prefijo "POSIBLE -" del nombre de la tarea si lo tiene
- Si NO hay hermanas: proceder con la eliminación como ahora

**2. Método `deduplicateTasks`**
- Después de fusionar duplicados y redirigir reservas, verificar si la tarea mantenida tiene "POSIBLE -" en el nombre pero alguna de las reservas vinculadas es CONFIRMED
- Si es así, actualizar el nombre quitando el prefijo

### Despliegue
- Re-desplegar la edge function `avantio-sync` tras los cambios

