
# Solicitudes extraordinarias desde el portal del cliente

## Resumen del flujo acordado

- **Sin aprobación admin**: cuando el cliente crea una solicitud, la tarea (`type='trabajo-extraordinario'`) se crea automáticamente.
- **Coste visible**: el cliente ve el precio del tipo seleccionado antes de confirmar; debe aceptar antes de enviar.
- **Catálogo personalizable**: el admin gestiona los tipos (CRUD) desde el panel.
- **Toggle por cliente**: nuevo flag `clients.allow_extraordinary_requests` (default `false`), activable desde `ClientPortalsAdmin`.

## Cambios en base de datos (migración)

### Tabla `extraordinary_request_types` (catálogo)
- `id`, `code` (slug único), `label` (es), `icon` (texto, nombre de icono Lucide o emoji), `description` (text, opcional).
- `default_duration_minutes` (int, default 15).
- `requires_time` (bool, default false) — fuerza al cliente a indicar hora.
- `default_cost` (numeric, default 0) — precio mostrado al cliente.
- `is_active` (bool default true), `sort_order` (int).
- `sede_id` (uuid nullable — null = global, todas las sedes).
- timestamps.

**RLS**: lectura pública (anon + authenticated) de los activos; escritura solo admin/manager.

### Tabla `client_extraordinary_requests`
- `id`, `client_id` (FK), `property_id` (FK), `reservation_id` (FK nullable a `client_reservations`, `ON DELETE SET NULL`).
- `request_type_id` (FK `extraordinary_request_types`, `ON DELETE SET NULL`).
- `request_type_label_snapshot` (text) — preserva el nombre si se borra el tipo.
- `service_date` (date), `service_time` (time, nullable).
- `guest_name` (text, nullable), `notes` (text, nullable).
- `cost_snapshot` (numeric) — coste mostrado y aceptado por el cliente.
- `status` (text): `active` | `cancelled` | `completed`.
- `task_id` (FK `tasks`, `ON DELETE SET NULL`) — vinculada a la tarea creada.
- `sede_id` (NOT NULL, derivado de la propiedad).
- timestamps.

**RLS**:
- INSERT anon permitido si `clients.allow_extraordinary_requests=true` y `client_portal_access.is_active=true` para ese `client_id` (mismo patrón que `client_reservations`).
- SELECT anon limitado a su `client_id`.
- Admin/manager/supervisor: acceso completo según sede.

### Columna nueva en `clients`
- `allow_extraordinary_requests` boolean default `false`.

### Función `create_extraordinary_request_with_task` (RPC, SECURITY DEFINER)
Llamada desde el portal con: `client_id`, `property_id`, `request_type_id`, `service_date`, `service_time`, `guest_name`, `notes`, `reservation_id`.

Hace en una transacción:
1. Valida que `clients.allow_extraordinary_requests=true` y portal activo.
2. Lee el tipo y captura `label` + `cost` + `duration` + `requires_time`.
3. Inserta en `tasks`:
   - `type='trabajo-extraordinario'`
   - `propiedad_id`, `cliente_id`, `sede_id` (de la propiedad).
   - `date = service_date`.
   - `start_time` y `end_time` calculados (si no hay hora, usa `09:00` por defecto + duración).
   - `notes` con prefijo `[SOLICITUD CLIENTE - {label}] ({guest_name}) {notes}`.
   - `coste = cost_snapshot`.
   - `status='pending'`, `cleaner=NULL`.
4. Inserta el registro en `client_extraordinary_requests` con `task_id`.
5. Devuelve `request_id` y `task_id`.

Esto evita problemas de RLS encadenadas y garantiza atomicidad para anon.

## Edge function `notify-extraordinary-request`

Disparada desde el frontend tras la RPC con `request_id`:
- Email a `dgomezlimpatex@…` con: cliente, propiedad, tipo, fecha/hora, coste, notas.
- Asunto: `🆕 Nueva solicitud extraordinaria - {Cliente} - {Tipo}`.
- Reusa patrón de `send-portal-change-notification`.

## Frontend — Portal del cliente

### `ClientPortalDashboard.tsx`
- Nuevo tab **"Servicios Extra"** condicionado a `settings.allowExtraordinaryRequests`.
- Layout de tabs se vuelve dinámico (2/3/4 columnas) según flags.

### Componentes nuevos en `src/components/client-portal/`
- `ExtraordinaryRequestsTab.tsx` — lista solicitudes del cliente con badge estado y coste.
- `CreateExtraordinaryRequestModal.tsx`:
  - Selector de propiedad.
  - Grid de tipos disponibles (cards con icono, nombre, **coste destacado**).
  - Selector opcional "vincular a reserva" (próximas reservas de esa propiedad).
  - Fecha (siempre) + hora (solo si `requires_time`).
  - Nombre huésped + notas.
  - **Resumen final con coste total** y checkbox "Acepto el cargo de X €" antes de confirmar.

### Hook `useExtraordinaryRequests` en `useClientPortal.ts`
- `useExtraordinaryRequestTypes()` — lee catálogo activo.
- `useClientExtraordinaryRequests(clientId)` — lista del cliente.
- `useCreateExtraordinaryRequest()` — invoca la RPC + dispara la edge function.
- `useCancelExtraordinaryRequest()` — marca como `cancelled` y cancela tarea asociada.

## Frontend — Panel admin

### Toggle en `ClientPortalsAdmin.tsx`
- Switch nuevo "Permitir solicitudes extraordinarias" junto al de "Permitir creación de reservas" en el modal de configuración de portal del cliente.

### Nueva página `src/pages/ExtraordinaryRequestTypesAdmin.tsx`
Accesible desde la navegación admin (sección Configuración):
- CRUD del catálogo de tipos: tabla con orden, activar/desactivar, editar coste, duración, icono, requires_time, sede.
- Modal de creación/edición.

### Nueva página `src/pages/ExtraordinaryRequestsAdmin.tsx`
- Tabla con todas las solicitudes (filtros por estado, sede, cliente, fechas).
- Click en una solicitud → link a la tarea generada en el calendario.
- Acción "Cancelar" (cancela también la tarea asociada).

### En el detalle/listado de tareas
- Badge "Origen: Portal cliente" cuando `notes` empieza por `[SOLICITUD CLIENTE - …]` (no requiere columna nueva).

## Catálogo inicial sembrado (editable después)

Insertar al aplicar la migración (sede_id NULL = global):
- Early Check-in — 30€ — requiere hora — 0 min.
- Late Check-out — 30€ — requiere hora — 0 min.
- Cuna — 0€ — sin hora — 15 min.
- Silla bebé — 0€ — sin hora — 15 min.
- Decoración especial — 50€ — sin hora — 30 min.
- Welcome pack extra — 25€ — sin hora — 15 min.

El admin podrá editarlos/borrarlos/añadir nuevos.

## Consideraciones

- **Zona horaria**: usar `formatMadridDate` para fechas (regla del proyecto).
- **Anti-abuso**: rate limit en la RPC (máx. 10 solicitudes/cliente/día) + restricción de fechas (mismo día o futuro, máx. 90 días).
- **Cancelación de reserva vinculada**: si se cancela la reserva, marcar las solicitudes vinculadas como `cancelled` y cancelar la tarea (trigger).
- **Cancelación de la solicitud**: tanto el cliente como el admin pueden cancelar; siempre cancela la tarea asociada (`status='cancelled'`).
- **Reportes**: las tareas extraordinarias ya están excluidas de algunos reportes (regla existente); no se altera ese comportamiento.

## Archivos a crear/modificar

**Migración**:
- Nueva migración con tablas, columna en `clients`, RPC, RLS, datos seed.

**Edge function**:
- `supabase/functions/notify-extraordinary-request/index.ts`.

**Tipos**:
- `src/types/extraordinaryRequest.ts`.

**Hooks**:
- `src/hooks/useClientPortal.ts` (añadir hooks).
- `src/hooks/useExtraordinaryRequestTypes.ts` (admin CRUD).

**Portal cliente**:
- `src/components/client-portal/ExtraordinaryRequestsTab.tsx` (nuevo).
- `src/components/client-portal/CreateExtraordinaryRequestModal.tsx` (nuevo).
- `src/components/client-portal/ClientPortalDashboard.tsx` (añadir tab).

**Admin**:
- `src/pages/ExtraordinaryRequestTypesAdmin.tsx` (nuevo).
- `src/pages/ExtraordinaryRequestsAdmin.tsx` (nuevo).
- `src/components/admin/...` modal del toggle en `ClientPortalsAdmin.tsx`.
- `src/App.tsx` + navegación: añadir rutas y entradas de menú.
