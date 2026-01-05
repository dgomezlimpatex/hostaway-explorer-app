# Integración con Avantio Channel Manager

## Descripción

Esta integración permite sincronizar automáticamente las reservas de Avantio con el sistema de gestión de limpiezas. La sincronización se ejecuta 3 veces al día (09:00, 14:00, 19:00) y crea tareas de limpieza automáticamente para cada checkout.

## Funcionamiento

### Sincronización de Reservas

1. **Rango de sincronización**: Se obtienen las reservas con checkout en los próximos 30 días
2. **Creación de tareas**: Por cada reserva confirmada, se crea una tarea de limpieza para el día del checkout
3. **Identificación**: Cada reserva se identifica por el ID único de Avantio y el nombre del huésped
4. **Gestión de cambios**: Si una reserva cambia de fecha, la tarea se actualiza automáticamente
5. **Cancelaciones**: Las reservas canceladas eliminan automáticamente sus tareas asociadas

### Horarios de Sincronización

- **09:00** - Sincronización Mañana
- **14:00** - Sincronización Mediodía  
- **19:00** - Sincronización Tarde

## Configuración

### Secretos Requeridos

Configura los siguientes secretos en Supabase (Settings > Edge Functions > Secrets):

| Secreto | Descripción | Requerido |
|---------|-------------|-----------|
| `AVANTIO_API_URL` | URL base de la API de Avantio | ✅ Sí |
| `AVANTIO_API_KEY` | API Key de autenticación | ✅ Sí |
| `AVANTIO_CLIENT_ID` | Client ID para OAuth | ❌ Opcional |
| `AVANTIO_CLIENT_SECRET` | Client Secret para OAuth | ❌ Opcional |

### Mapeo de Propiedades

Para que la sincronización funcione correctamente, cada propiedad debe tener configurado el campo `avantio_accommodation_id` con el ID correspondiente en Avantio.

1. Ve a **Propiedades**
2. Edita cada propiedad
3. Añade el **ID de Avantio** en el campo correspondiente

## API de Avantio

### Endpoints Esperados

La integración está preparada para trabajar con los siguientes endpoints (ajustar según documentación real de Avantio):

```
GET /bookings - Obtener reservas
  - checkout_from: Fecha inicio de rango
  - checkout_to: Fecha fin de rango
  - offset: Paginación
  - limit: Límite de resultados

GET /accommodations - Obtener propiedades
```

### Estructura de Reserva Esperada

```json
{
  "id": "12345",
  "accommodation_id": "ACC001",
  "accommodation_name": "Apartamento Centro",
  "status": "confirmed",
  "check_in": "2025-01-10",
  "check_out": "2025-01-15",
  "guest_name": "Juan García",
  "guest_email": "juan@email.com",
  "adults": 2,
  "children": 0,
  "total_amount": 500.00,
  "currency": "EUR"
}
```

**NOTA**: Los nombres de campos pueden variar según la API real de Avantio. El código incluye mapeos flexibles para diferentes formatos.

## Tablas de Base de Datos

### avantio_reservations
Almacena las reservas sincronizadas de Avantio.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | ID interno |
| avantio_reservation_id | TEXT | ID único en Avantio |
| property_id | UUID | Referencia a propiedad local |
| guest_name | TEXT | Nombre del huésped |
| arrival_date | DATE | Fecha de entrada |
| departure_date | DATE | Fecha de salida (checkout) |
| status | TEXT | Estado de la reserva |
| task_id | UUID | Referencia a tarea de limpieza |

### avantio_sync_logs
Registro de todas las sincronizaciones.

### avantio_sync_schedules
Horarios de sincronización automática.

## Gestión de Errores

### Errores Comunes

1. **Propiedad no encontrada**: La reserva tiene un `accommodation_id` que no está mapeado a ninguna propiedad local
   - **Solución**: Configurar `avantio_accommodation_id` en la propiedad correspondiente

2. **Credenciales inválidas**: Error de autenticación con la API
   - **Solución**: Verificar que los secretos están correctamente configurados

3. **Timeout**: La API de Avantio no responde
   - **Solución**: El sistema reintenta automáticamente hasta 3 veces

### Logs y Monitoreo

- Los logs de sincronización están disponibles en la página de **Automatización Avantio**
- Los errores se registran en la tabla `avantio_sync_errors`
- Se pueden ver los logs detallados en los Edge Function Logs de Supabase

## Consideraciones de Seguridad

- Las credenciales de Avantio se almacenan como secretos cifrados en Supabase
- Las políticas RLS restringen el acceso solo a administradores y managers
- Los cron jobs se ejecutan con el service role de Supabase

## Diferencias con Hostaway

| Aspecto | Hostaway | Avantio |
|---------|----------|---------|
| Color de tareas | Azul (#3B82F6) | Verde (#10B981) |
| Campo de mapeo | `hostaway_listing_id` | `avantio_accommodation_id` |
| Estados de reserva | new, modified, cancelled | confirmed, pending, cancelled |
| Tabla de reservas | `hostaway_reservations` | `avantio_reservations` |

## Próximos Pasos

Cuando tengas acceso a la API de Avantio:

1. Configura los secretos en Supabase
2. Ajusta los endpoints en `avantio-api.ts` según la documentación real
3. Ajusta el mapeo de campos de reserva según la estructura real
4. Mapea las propiedades con sus IDs de Avantio
5. Ejecuta una sincronización manual de prueba
6. Configura la automatización

## Archivos Relacionados

- `supabase/functions/avantio-sync/` - Edge function de sincronización
- `supabase/functions/manage-avantio-cron/` - Gestión de cron jobs
- `src/services/avantioSync.ts` - Servicio frontend
- `src/pages/AvantioAutomation.tsx` - Página de administración
- `src/types/avantio.ts` - Tipos TypeScript
