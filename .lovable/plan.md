
# Integración Little Hotelier → Limpatex (After Surf)

Adaptamos la propuesta de Claude a los patrones reales de la app (sedes, RLS por sede, `tasks`, mapeo property↔habitación, emails consolidados). Lo más particular: este hotel necesita **dos tipos de limpieza por reserva**: la de **salida** (check-out) y las **diarias durante la estancia**, cada una con precio/duración/propiedad propia.

## 1. Modelo de datos

### Tabla `lh_reservations` (espejo de la reserva)
- Campos: `external_id` (único), `uuid`, `reference`, `channel`, `check_in`, `check_out`, `room` (texto LH, ej. "Habitación 2"), `guest_name`, `adults`, `children`, `infants`, `status`, `total`, `synced_at`, `sede_id`, `created_at`, `updated_at`.
- Índices: `check_in`, `check_out`, `status`, `room`, `sede_id`.
- RLS:
  - SELECT: usuarios con acceso a la sede (mismo patrón que `hostaway_reservations`).
  - INSERT/UPDATE/DELETE: sólo `service_role` (la Edge Function).

### Tabla `lh_room_mapping` (la pieza clave del caso After Surf)
Una fila por **habitación de LH × tipo de servicio**, con la idea que sugeriste de duplicar propiedades (una para salida y otra para estancia):

| Columna | Uso |
|---|---|
| `id`, `created_at`, `updated_at` | std |
| `sede_id` | sede dueña |
| `lh_room` | texto exacto que llega de LH (`"Habitación 2"`) |
| `service_kind` | `'checkout'` o `'stay'` |
| `cliente_id` | FK clients (After Surf) |
| `propiedad_id` | FK properties (puede ser distinta para checkout vs stay) |
| `task_type` | ej. `limpieza-turistica` o `limpieza-hotel-estancia` |
| `default_start_time` | hora por defecto (ej. 11:00 salida, 10:00 estancia) |
| `default_duration_min` | en minutos, 15-min steps |
| `default_cost` | coste por tarea |
| `is_active` | booleano |

- Unique `(lh_room, service_kind, sede_id)`.
- RLS estándar admin/manager edita, otros ven.
- Permite que cada habitación tenga **dos propiedades distintas** (una "Hab. 2 — Salida", otra "Hab. 2 — Estancia") con precios/tiempos diferentes, sin tocar la lógica del resto de la app.

### Tabla `lh_alert_log` (anti-spam para alertas opcionales)
Igual patrón que `avantio_alert_log`.

### Nuevo `task_type` opcional
Si decides separar reportes: añadir `limpieza-hotel-estancia` al enum de tipos. Si prefieres reutilizar `limpieza-turistica` y diferenciar por propiedad, se puede.

## 2. Edge Function `little-hotelier-sync`

Recibe el POST que ya manda tu script Python (formato del PROMPT que enviaste). Estructura modular como `hostaway-sync/`:

```
supabase/functions/little-hotelier-sync/
  index.ts                  // HTTP entrypoint + CORS + auth
  types.ts
  reservation-upsert.ts     // upsert en lh_reservations
  task-generator.ts         // genera tareas checkout + diarias
  task-reconciler.ts        // aplica cambios/cancelaciones
  email-summary.ts          // email consolidado de cambios
```

Comportamiento por petición (1 reserva):

1. **Auth**: header `Authorization: Bearer <LH_SYNC_API_KEY>` (secret nuevo).
2. **Validar** `external_id`, `check_in`, `check_out`, `room`. Devolver 400 si falta.
3. **Upsert** en `lh_reservations` con `onConflict: external_id`. Detectar diff vs versión previa (fechas / status / room).
4. **Mapeo**: leer `lh_room_mapping` por `lh_room`. Si no hay fila para `checkout` y/o `stay` con `is_active=true`, se omite ese tipo y se registra warning para que un admin lo configure.
5. **Generar tareas**:
   - **Salida** (`service_kind='checkout'`): 1 tarea el día `check_out`, hora/duración/coste del mapping. Una sola.
   - **Estancia** (`service_kind='stay'`): N tareas, una por día entre `check_in + 1 día` y `check_out - 1 día` (ambos inclusive). Si `check_out - check_in <= 1`, no genera ninguna.
   - Las tareas se crean con: `cliente_id`, `propiedad_id`, `sede_id`, `type`, `start_time`/`end_time` derivados, `duracion`, `coste`, `notes` con prefijo `[LH ${reference}] ${guest_name}`.
   - Idempotencia: vincular cada tarea creada en una tabla `lh_reservation_tasks (reservation_id, task_id, service_kind, task_date)` con unique `(reservation_id, service_kind, task_date)` → evita duplicados en reintentos / re-envíos.
6. **Reconciliación** (cuando la reserva ya existía):
   - Si `status` pasa a `cancelled`/`no_show`: marcar las tareas vinculadas no completadas como `cancelled` y borrar las futuras pendientes (mismo criterio que hostaway). Tareas ya completadas se respetan.
   - Si cambian fechas/room: comparar tareas esperadas vs existentes, crear las nuevas necesarias, cancelar las que sobran, y registrar cambios para el email resumen.
7. **Email consolidado** (al estilo `send-task-reschedule-batch-email`): si hubo cambios, encolar un email a admins con: reserva, qué tareas se crearon, cuáles se cancelaron, cuáles se modificaron.
8. **Respuesta**: `{ success, reservation_id, tasks_created, tasks_cancelled, tasks_modified, warnings }`.

Secrets a añadir vía la tool:
- `LH_SYNC_API_KEY` (Bearer que valida el endpoint).

## 3. UI nueva

### Página `/integraciones/little-hotelier` (sólo admin/manager)
Pestañas:

1. **Reservas LH**: tabla con filtros (rango fechas, status, room, search). Muestra `reference`, huésped, room, check-in/out, noches, status, canal, total, número de tareas vinculadas. Click en fila → detalle con timeline de tareas creadas/canceladas.
2. **Mapeo habitaciones**: CRUD sobre `lh_room_mapping`. Muestra cada `lh_room` con sus dos filas (checkout / stay). Botón "Detectar nuevas habitaciones" que lista los `lh_room` distintos vistos en reservas que aún no tienen mapping para `service_kind`. Permite crear filas eligiendo cliente/propiedad/tipo/hora/duración/coste.
3. **Logs**: últimos POST recibidos (timestamp, external_id, resultado, warnings) — útil para depurar el script Python. Se guardan en una `lh_sync_logs` simple (ttl 30 días).

### Navegación
Añadir card en `RoleBasedNavigation.tsx` dentro del bloque `canAccessModule('reports'|'integrations')` (donde ya están Hostaway/Avantio). Icono `Hotel` de lucide. Ruta nueva en `App.tsx`.

### Hooks
- `useLHReservations(filters)` con React Query.
- `useLHRoomMappings()` + mutaciones de CRUD.
- Reutilizar componentes shadcn (`Table`, `Badge`, `Dialog`, `Form`).

## 4. Reglas operativas confirmadas

- Limpieza de estancia: **1/día entre `check_in+1` y `check_out-1`**, hora y duración por mapping.
- Limpieza de salida: **1 el día de check_out**, con propiedad/precio propios.
- Cancelación/cambio de fechas → ajuste automático + email resumen al admin.
- Todo respeta sede activa, RLS, formato Madrid (`formatMadridDate`) y duraciones en steps de 15 min.

## 5. Pasos para tu lado (no es código)

- Crear/duplicar en la app las propiedades de After Surf: por cada habitación, dos propiedades (`After Surf — Hab. 2 (Salida)`, `After Surf — Hab. 2 (Estancia)`) con sus precios/tiempos.
- Entrar en la nueva página y rellenar el mapping para cada habitación (checkout + stay).
- En el `.env` del script Python configurar:
  - `APP_URL = https://qyipyygojlfhdghnraus.supabase.co/functions/v1/little-hotelier-sync`
  - `APP_API_KEY = <LH_SYNC_API_KEY>` (el secret que generaremos).

## 6. Detalles técnicos (resumen)

- Migraciones: `lh_reservations`, `lh_room_mapping`, `lh_reservation_tasks`, `lh_sync_logs`, `lh_alert_log`, índices, RLS, trigger `updated_at` reusando `update_updated_at_column`. FK de `lh_reservation_tasks.task_id` → `tasks(id) ON DELETE SET NULL` (regla del proyecto).
- Edge Function: `verify_jwt=false` (acceso por Bearer propio), CORS estándar, validación con Zod, `service_role` interno.
- Emails: usar el mismo patrón de `send-task-reschedule-batch-email` para no inventar infra nueva.
- Tipos TS: regenerar `src/integrations/supabase/types.ts` se hace solo tras la migración.

## 7. Fuera de alcance (de momento)

- No reemplazamos Avantio/Hostaway.
- No conectamos a la API de Little Hotelier desde Supabase: la fuente sigue siendo tu script Python que hace POST.
- No tocamos la lógica existente de otras integraciones.

Tras tu OK, lo implemento en este orden: migración → mapping UI mínima → edge function con generación de tareas → email resumen → página de reservas/logs → enlace en navegación.
