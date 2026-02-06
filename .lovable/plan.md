

# Plan: Integracion directa con API de Avantio (PMS v1)

## Resumen

Reescribir la edge function `avantio-sync` para usar la API real de Avantio PMS v1, basandonos en el codigo exacto del Apps Script. Se crearan tareas de limpieza para todas las reservas confirmadas en la fecha de checkout, con gestion completa de cambios (crear, modificar, eliminar) y un panel de errores visible en la pagina de administracion.

## Que se hara

### 1. Reescribir `avantio-api.ts` (cambio principal)

El archivo actual usa endpoints inventados. Se reescribira completamente para usar la API real:

- **URL base**: `https://api.avantio.pro/pms/v1` (hardcoded, no necesita secreto)
- **Autenticacion**: Header `X-Avantio-Auth` con token desde el secreto `AVANTIO_API_TOKEN`
- **Listado**: `GET /bookings?limit=50&sort=creationDate&order=desc` (paginado via `_links.next`)
- **Detalle**: `GET /bookings/{id}` para obtener fechas y alojamiento de cada reserva
- **Filtrado**: Solo reservas con checkout entre hoy-10 y hoy+30 dias
- **Corte de paginacion**: Cuando `creationDate` supere 120 dias de antiguedad
- **Extraccion de campos**: `detail.dates.arrival`, `detail.dates.departure`, `detail.status`, `detail.accommodation.name/internalName`, `detail.id`
- Se elimina la funcion `getAvantioToken()` (ya no hay OAuth) y se lee directamente el token del entorno
- Se mantiene el sistema de reintentos con backoff exponencial para errores 429/5xx

### 2. Configurar secreto `AVANTIO_API_TOKEN`

Se pedira al usuario que guarde el token de autenticacion como secreto de Supabase. Los secretos anteriores (`AVANTIO_API_KEY`, `AVANTIO_API_URL`, `AVANTIO_CLIENT_ID`, `AVANTIO_CLIENT_SECRET`) dejan de usarse.

### 3. Ajustar `index.ts`

Cambiar la verificacion de `AVANTIO_API_KEY` a `AVANTIO_API_TOKEN`.

### 4. Ajustar `sync-orchestrator.ts`

El orquestador actual llama a `getAvantioToken()` y `fetchAllAvantioReservations(token, start, end)`. Se adaptara al nuevo flujo donde `avantio-api.ts` devuelve directamente las reservas filtradas con la paginacion incluida (listado + detalle por cada reserva).

### 5. Ajustar `database-operations.ts` - Busqueda exacta de propiedades

La funcion `findPropertyByAvantioId` se modificara para:
- Buscar primero por `avantio_accommodation_id` (coincidencia exacta)
- Si no encuentra, buscar por nombre **exacto** (no parcial con `ilike %...%`) filtrando solo propiedades del cliente Turquoise (`cliente_id = '669948a6-e5c3-4a73-a151-6ccca5c82adf'`)
- Si no encuentra por nombre, buscar por codigo **exacto**
- No usar match parcial para evitar confundir propiedades similares (ej: MD18.1 vs MD18.1B)

### 6. Simplificar `reservation-validator.ts`

Eliminar cualquier logica de "extra de limpieza". Crear tarea para toda reserva no cancelada con checkout en el futuro. La logica actual ya hace esto correctamente, solo se limpiaran comentarios.

### 7. Actualizar `response-builder.ts`

Cambiar el mensaje de configuracion para que muestre `AVANTIO_API_TOKEN` en lugar de los secretos antiguos.

### 8. Registrar errores en `avantio_sync_errors`

La tabla `avantio_sync_errors` ya existe en la base de datos con campos: `sync_log_id`, `error_type`, `error_message`, `error_details` (jsonb), `resolved`, `resolved_at`. Actualmente no se usa. Se modificara `reservation-processor.ts` para que cada error individual se registre tambien en esta tabla, ademas de en el array `stats.errors`. Tipos de error a registrar:
- `property_not_found`: Propiedad de Avantio sin match local
- `task_creation_failed`: Error al crear tarea de limpieza
- `task_update_failed`: Error al actualizar tarea
- `task_deletion_failed`: Error al eliminar tarea cancelada
- `reservation_save_failed`: Error al guardar reserva en BD
- `api_error`: Error de comunicacion con la API de Avantio

### 9. Panel de errores en la pagina de administracion

Anadir una seccion nueva en `AvantioAutomation.tsx` que muestre:
- Lista de errores recientes de la tabla `avantio_sync_errors`
- Filtro por errores no resueltos
- Boton para marcar un error como resuelto
- Tipo de error, mensaje, fecha, y si esta vinculado a un log de sincronizacion
- Badge con el conteo de errores sin resolver visible en las tarjetas superiores

### 10. Mejorar detalle de logs existentes

En la seccion "Ultimas Sincronizaciones", al hacer clic en un log se expandira para mostrar:
- Tareas creadas (con propiedad y fecha)
- Tareas modificadas (con fecha anterior y nueva)
- Tareas canceladas (con propiedad y motivo)
- Errores de esa sincronizacion especifica

## Gestion completa de cambios (crear/modificar/eliminar)

Esta logica **ya esta implementada** en `reservation-processor.ts` y funciona correctamente:

- **Crear**: Reserva nueva no cancelada con checkout futuro -> crea tarea de limpieza en la fecha de checkout
- **Modificar**: Reserva existente con cambio en `departureDate` -> actualiza la fecha de la tarea (incluye notificacion por email al limpiador si tiene uno asignado)
- **Eliminar**: Reserva cancelada (status=CANCELLED o con cancellationDate) -> elimina la tarea asociada y marca la reserva como cancelada

No se necesitan cambios en esta logica, solo en la capa de API y la visibilidad de errores.

## Detalles tecnicos

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/avantio-sync/avantio-api.ts` | Reescritura completa con API real |
| `supabase/functions/avantio-sync/index.ts` | Cambiar verificacion de secreto |
| `supabase/functions/avantio-sync/sync-orchestrator.ts` | Adaptar al nuevo flujo de API |
| `supabase/functions/avantio-sync/database-operations.ts` | Busqueda exacta + registro de errores en `avantio_sync_errors` |
| `supabase/functions/avantio-sync/reservation-processor.ts` | Registrar errores en tabla `avantio_sync_errors` |
| `supabase/functions/avantio-sync/reservation-validator.ts` | Limpiar comentarios (logica ya correcta) |
| `supabase/functions/avantio-sync/response-builder.ts` | Actualizar mensaje de configuracion |
| `supabase/functions/avantio-sync/types.ts` | Anadir tipos para respuesta real de API |
| `src/pages/AvantioAutomation.tsx` | Anadir panel de errores y detalle expandible de logs |
| `src/services/avantioSync.ts` | Anadir funciones para obtener/resolver errores |

### Archivos que NO cambian

- `supabase/functions/manage-avantio-cron/index.ts` - Funciona correctamente
- Tablas de base de datos - La estructura existente es valida
- `src/integrations/supabase/types.ts` - Se genera automaticamente

### Flujo de la sincronizacion

```text
avantio-sync (edge function)
  |
  1. Leer AVANTIO_API_TOKEN
  |
  2. GET /bookings?limit=50&sort=creationDate&order=desc
  |     |
  |     Por cada reserva en la pagina:
  |       - Si creationDate < (hoy - 120 dias) -> STOP
  |       - GET /bookings/{id} (detalle)
  |       - Extraer checkout de dates.departure
  |       - Si checkout fuera de rango -> skip
  |       - Buscar propiedad por nombre/codigo EXACTO (solo Turquoise)
  |       - Si no encuentra propiedad -> error a avantio_sync_errors
  |       |
  |       Si reserva NUEVA + no cancelada:
  |         -> Crear en avantio_reservations + crear tarea limpieza
  |       |
  |       Si reserva EXISTENTE + fecha checkout cambio:
  |         -> Actualizar tarea (nueva fecha) + notificar limpiador
  |       |
  |       Si reserva CANCELLED:
  |         -> Eliminar tarea asociada + marcar cancelada
  |     |
  |     Si hay _links.next -> siguiente pagina
  |
  3. Guardar log en avantio_sync_logs
  4. Guardar errores individuales en avantio_sync_errors
```

