
# Reservas multi-habitación y sin habitación en Little Hotelier

## Diagnóstico

Las "habitaciones sin mapear" no son habitaciones reales. Son dos casos que hoy llegan al endpoint en el campo `room`:

1. **Multi-habitación concatenada**: cuando una reserva ocupa varias habitaciones, el script Python las concatena en un solo string:
   - `"Habitación 5Habitación 2(+1 Más)"` (3 hab.)
   - `"Habitación 6Habitación 4(+1 Más)"`
   - `"Habitación doble sin vistas 3 1Habitación 4(+1 Más)"`
   
   El `(+N Más)` indica que el script ni siquiera muestra los nombres a partir del tercero — la info está perdida en origen.

2. **Habitación sin asignar** (`room = "-"`): reservas confirmadas vía Booking.com / canales que aún no tienen habitación asignada en Little Hotelier. Sin habitación no se puede saber a qué propiedad mapear.

Ambos casos están bien clasificados (no son mapeos faltantes), pero el detector los muestra como ruido y nunca generarán tareas. Hay que arreglarlos en origen.

## Solución

### 1. Cambiar el contrato del endpoint para aceptar varias habitaciones
En la Edge Function `little-hotelier-sync` aceptar **dos formatos** en el payload, manteniendo compatibilidad:
- Nuevo: `rooms: ["Habitación 5", "Habitación 2", "Habitación 7"]` (array).
- Antiguo: `room: "Habitación 2"` (string) → se normaliza a array de 1.

En `lh_reservations` añadir columna `rooms text[]` (además de seguir guardando `room` como string legible para UI). Generar tareas iterando por cada habitación: por cada una buscar su mapping `checkout` + `stay` y crear las tareas correspondientes. La idempotencia ya usa `(reservation_id, service_kind, task_date)` — la extenderemos a `(reservation_id, lh_room, service_kind, task_date)` para no colisionar entre habitaciones de la misma reserva.

### 2. Actualizar el script Python (lado del usuario)
El script tiene que dejar de concatenar y mandar el array completo de habitaciones reales tal y como las devuelve la API de Little Hotelier. Te pasaré el snippet exacto a cambiar — es 1 línea en el bloque donde hoy construye el string `room`.

### 3. Tratar `room = "-"` como caso especial
- No registrar la reserva como "sin mapear" en el detector.
- Marcar la reserva con un flag `needs_room_assignment = true` en `lh_reservations`.
- Mostrar en la pestaña "Reservas" un badge ámbar "Sin habitación asignada" con tooltip explicando que hay que asignarla en Little Hotelier.
- Opcional (pregunta más abajo): enviar email de alerta al admin la primera vez que se ve, con anti-spam estilo `avantio_alert_log`.
- Cuando una sync posterior traiga la habitación ya asignada, se generan las tareas automáticamente y el flag se limpia.

### 4. Limpiar el detector de "Habitaciones sin mapear"
Filtrar del listado:
- Valores que contengan `(+` o que matcheen más de un `"Habitación"` (formato concatenado antiguo, hasta que repases la sync).
- Valor `"-"` y vacío.

Así sólo aparecerán habitaciones reales pendientes de mapear (ahora mismo, sólo la 3 según comentas).

### 5. Reprocesar lo ya guardado
Tras desplegar:
- Re-ejecutar tu script Python con el cambio → cada reserva multi-habitación llegará como array y generará todas las tareas.
- Las reservas con `"-"` quedarán en estado "pendiente de habitación" hasta que las asignes en Little Hotelier y la próxima sync las recoja.

## Detalles técnicos

- Migración: `ALTER TABLE lh_reservations ADD COLUMN rooms text[], ADD COLUMN needs_room_assignment boolean DEFAULT false;` + backfill desde `room`.
- Migración: `ALTER TABLE lh_reservation_tasks ADD COLUMN lh_room text;` + recrear unique a `(reservation_id, lh_room, service_kind, task_date)`.
- Edge function: helper `normalizeRooms(payload)` que devuelve `string[]` filtrando `"-"`, vacíos y patrones `(+N Más)` (loggea warning si detecta el formato viejo concatenado).
- UI:
  - Pestaña Reservas: columna "Habitaciones" muestra chips por cada room; badge "Sin habitación" cuando `needs_room_assignment`.
  - Pestaña Mapeo → "Detectar nuevas habitaciones": query a `lh_reservations.rooms` (unnest) excluyendo las que ya tengan mapping. Ya no aparecerán los strings concatenados ni `"-"`.

## Pregunta para ti

¿Quieres alerta por email cuando llegue una reserva con `room = "-"` (sin habitación asignada en LH), o basta con el badge en la UI? Es el único punto donde aún no he decidido por ti.

## Tras tu OK

1. Migración (rooms[], needs_room_assignment, índice).
2. Edge function: aceptar `rooms[]`, generar tareas por habitación.
3. UI: chips + badge + filtro del detector.
4. Te paso el cambio exacto para el script Python.
