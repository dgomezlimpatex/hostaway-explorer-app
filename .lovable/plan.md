
## Plan: Marcar tareas de reservas REQUESTED como "POSIBLE"

### Problema
Las reservas con estado `REQUESTED` generan tareas de limpieza, pero no siempre se confirman. Actualmente no hay forma visual de distinguir estas tareas de las confirmadas.

### Solucion

Modificar la logica de sincronizacion de Avantio para que:

1. **Al crear una tarea** de una reserva con estado `REQUESTED`, el nombre de la tarea incluya el prefijo `POSIBLE - ` (ejemplo: `POSIBLE - PA10.3` en vez de `PA10.3`).

2. **Al actualizar una reserva existente**, si el estado cambia de `REQUESTED` a otro estado (como `confirmed`), se actualice el nombre de la tarea eliminando el prefijo `POSIBLE - `.

3. **Si el estado vuelve a `REQUESTED`**, se vuelve a poner el prefijo.

### Cambios tecnicos

**Archivo: `supabase/functions/avantio-sync/database-operations.ts`**
- En `createTaskForReservation`: recibir el status de la reserva y, si es `REQUESTED`, usar `POSIBLE - ${property.nombre}` como nombre de la tarea.
- Crear una nueva funcion `updateTaskProperty` para actualizar el campo `property` (nombre) de una tarea existente.

**Archivo: `supabase/functions/avantio-sync/reservation-processor.ts`**
- En `handleExistingReservation`: detectar si el status cambio y, si la tarea existe, actualizar el nombre:
  - Si el nuevo status es `REQUESTED` y el nombre no tiene prefijo, agregar `POSIBLE - `.
  - Si el nuevo status ya no es `REQUESTED` y el nombre tiene el prefijo, eliminarlo.
- Pasar el status de la reserva a `createTaskForReservation`.

### Ejemplo visual

| Estado reserva | Nombre de tarea |
|---|---|
| REQUESTED | POSIBLE - PA10.3 |
| confirmed | PA10.3 |
| unpaid | PA10.3 |
