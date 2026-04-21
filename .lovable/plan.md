

# Plan: Portal del Cliente — Tareas externas, fotos del reporte, panel admin de portales y control granular de fotos

Combina las mejoras del portal del cliente con dos nuevas capacidades: panel admin para acceder a cualquier portal sin PIN, y **control por cliente** para activar/desactivar la visibilidad de fotos del reporte.

---

## Parte 1 — Tareas externas en calendario y listado del cliente

**Para el cliente:** verá en su listado y calendario **todas** las limpiezas asociadas a sus propiedades (Avantio, Hostaway, recurrentes, batch, manuales). Las externas aparecen mezcladas, marcadas con badge "Sincronizada" y un icono de candado, **solo lectura** (sin botones Editar/Cancelar).

**Por dentro:**
- Nuevo hook `useClientPortalBookings(clientId)` que mezcla `client_reservations` (manuales) con `tasks` filtradas por `cliente_id`, excluyendo las que ya están vinculadas a una `client_reservation` (evita duplicados).
- Las RLS de `tasks` ya permiten lectura anónima vía portal activo, **sin cambios DB**.
- Tipo unificado `PortalBooking` con `source: 'manual' | 'external'` e `isEditable`.
- Las tareas externas no tienen `check_in_date`: se pintan como un único día de limpieza usando `task.date`.

---

## Parte 2 — Fotos del reporte visibles para el cliente (con control granular)

**Para el cliente:** cada reserva/tarea pasa a ser clickable → modal de detalle con cabecera (propiedad, fecha, estado de limpieza). Si la tarea está **completada** Y el cliente tiene la opción de fotos activada → galería de fotos (grid + lightbox). Si no → mensaje amable "El reporte estará disponible cuando el equipo termine la limpieza".

**Control por cliente (NUEVO):**
- Nueva columna `photos_visible_to_client BOOLEAN DEFAULT false` en la tabla `clients`.
- **Por defecto desactivado** para todos los clientes existentes y nuevos: hay que activarlo manualmente cliente a cliente.
- Toggle visible en dos sitios:
  - **Modal de edición de cliente** (`EditClientModal`): switch "Permitir al cliente ver fotos del reporte" con texto explicativo.
  - **Panel admin de portales** (Parte 3): columna con switch para activar/desactivar rápidamente sin abrir el cliente.
- Si está desactivado, el cliente sigue viendo el modal de detalle de la tarea (estado, fecha, propiedad) pero **sin la sección de galería** — ni siquiera aparece el placeholder de fotos.

**Por dentro:**
- Migración: añadir `photos_visible_to_client` a `clients` (default `false`).
- 2 políticas RLS nuevas (lectura anónima):
  - `task_reports` SELECT anon: la task pertenece a un cliente con portal activo Y `overall_status = 'completed'` Y `clients.photos_visible_to_client = true`.
  - `task_media` SELECT anon: condicionado al mismo criterio vía `task_report_id`.
- Bucket `task-reports-media` ya es público → URLs accesibles, sin cambios de Storage.
- Nuevo hook `useClientPortalTaskReport(taskId)` que devuelve `{ status: 'not_ready' | 'photos_disabled' | 'ready', media }`.
- Componente nuevo `ReservationDetailModal.tsx` con galería + lightbox condicional.
- `clientMappers.ts` y `ClientFormSchema.ts` añaden el campo nuevo.

---

## Parte 3 — Panel admin "Portales de clientes" (NUEVO)

**Para el admin:** nueva entrada en el sidebar **"Portales de clientes"** (sección Administración, sólo admin/manager) con tabla de todos los clientes:

- Nombre del cliente
- Estado del portal: ✅ Activo / ⚠️ Sin crear / ⏸️ Desactivado
- PIN (oculto, botón 👁 para mostrar)
- URL del portal (botón 📋 copiar, botón 🔗 abrir)
- **Fotos visibles**: switch on/off (columna `photos_visible_to_client`)
- Última fecha de acceso del cliente
- Botón **"Acceder al portal"** → abre el portal en nueva pestaña **autenticado automáticamente** sin pedir PIN.
- Botón rápido para crear acceso si el cliente no tiene portal.

**Filtros y búsqueda:** buscador por nombre, filtro por estado (Activo / Inactivo / Sin crear), filtro por fotos (Habilitadas / Deshabilitadas).

**Acceso sin PIN para admins (cómo funciona):**
- Reutiliza `portal_token` + `short_code` ya existentes.
- Botón "Acceder al portal" abre `/portal/{slug}-{shortCode}?admin_bypass={token_temporal}`.
- `token_temporal` lo genera la nueva edge function `admin-portal-bypass` que:
  - Valida que el usuario esté autenticado y tenga rol `admin` o `manager`.
  - Devuelve un JWT corto (15 min) firmado con `PORTAL_BYPASS_SECRET`.
- En `ClientPortal.tsx`, si detecta `?admin_bypass=...`, lo valida contra `verify-portal-bypass` y crea sesión sin PIN.
- Queda registrado en logs (`accessed_by_admin`) para auditoría.

---

## Cambios concretos

**Base de datos (migración nueva)**
- `ALTER TABLE clients ADD COLUMN photos_visible_to_client BOOLEAN NOT NULL DEFAULT false`.
- Política RLS `task_reports` SELECT anon (portal activo + completado + fotos habilitadas).
- Política RLS `task_media` SELECT anon (vía task_report válido).
- (Opcional) columna `last_admin_access_at` en `client_portal_access` para distinguir accesos admin vs cliente.

**Secret nuevo**
- `PORTAL_BYPASS_SECRET` (firma del JWT temporal de bypass).

**Edge functions nuevas**
- `admin-portal-bypass` — genera JWT corto tras validar rol admin/manager.
- `verify-portal-bypass` — valida JWT y devuelve datos de sesión.

**Frontend — ficheros nuevos**
- `src/components/client-portal/ReservationDetailModal.tsx` — modal detalle + galería condicional + lightbox.
- `src/pages/ClientPortalsAdmin.tsx` — página admin con tabla, filtros y acciones.
- `src/components/admin/ClientPortalsTable.tsx` — tabla reutilizable con switch de fotos y botón "Acceder".
- `src/hooks/useAdminPortalBypass.ts` — llama a la edge function y abre la URL impersonada.

**Frontend — ficheros modificados**
- `src/types/client.ts` → añadir `photosVisibleToClient: boolean`.
- `src/types/clientPortal.ts` → nuevo tipo `PortalBooking`.
- `src/services/storage/mappers/clientMappers.ts` → mapear `photos_visible_to_client` ↔ `photosVisibleToClient`.
- `src/components/clients/forms/ClientFormSchema.ts` → añadir campo opcional al schema.
- `src/components/clients/forms/ServiceInfoSection.tsx` (o nuevo `PortalSettingsSection`) → switch "Permitir ver fotos del reporte".
- `src/hooks/useClientPortal.ts` → `useClientPortalBookings`, `useClientPortalTaskReport`, soporte `admin_bypass` en `useAuthenticatePortal`, mutación `useToggleClientPhotosVisibility`.
- `src/components/client-portal/ReservationsList.tsx` → bookings unificadas, badge "Sincronizada", fila clickable.
- `src/components/client-portal/ReservationsCalendar.tsx` y subviews → bookings unificadas, estilo distinto para externas.
- `src/components/client-portal/ClientPortalDashboard.tsx` → usar `useClientPortalBookings`.
- `src/pages/ClientPortal.tsx` → detectar `?admin_bypass=...` y crear sesión sin PIN.
- `src/components/dashboard/DashboardSidebar.tsx` y `MobileDashboardSidebar.tsx` → entrada "Portales de clientes" (admin/manager).
- `src/App.tsx` → ruta `/admin/client-portals` dentro de `AppLayout`.

**Sin cambios** en: storage buckets, sincronización Avantio/Hostaway, flujo de la limpiadora, PINs existentes.

---

## Notas UX

- El switch de fotos por cliente se llama **"Permitir al cliente ver fotos del reporte"** con texto secundario: *"Si está desactivado, el cliente verá los detalles de la limpieza pero no las fotografías"*.
- Por defecto todos los clientes (existentes y nuevos) tendrán fotos **desactivadas** → activación explícita y consciente por parte del admin.
- Diferenciación visual manual vs sincronizada con badge sutil + candado.
- Si no hay reporte aún o las fotos están desactivadas → placeholder amable, no error.
- En el panel admin, marcar visualmente accesos por bypass admin (icono "👤 admin") en logs.

---

## Orden sugerido de implementación

1. **Migración DB** (campo `photos_visible_to_client` + políticas RLS).
2. **Parte 1** (tareas externas) — desbloquea visibilidad inmediata.
3. **Parte 2** (fotos + modal detalle + control granular en EditClientModal).
4. **Parte 3** (panel admin + edge functions de bypass + switch de fotos en tabla).

