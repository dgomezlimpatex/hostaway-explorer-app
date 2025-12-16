# Integración Octorate - Sincronización de Reservas

## Resumen del Proyecto

**Objetivo:** Sincronizar automáticamente las reservas del hotel desde Octorate para crear tareas de limpieza, similar a la integración existente con Hostaway.

**Estado:** ⏳ Pendiente - Esperando credenciales OAuth

---

## Credenciales Necesarias

Para implementar esta integración necesitas obtener de Octorate:

| Credencial | Descripción | Estado |
|------------|-------------|--------|
| `client_id` | Identificador único de la aplicación | ❌ Pendiente |
| `client_secret` | Clave secreta para autenticación | ❌ Pendiente |

**¿Cómo obtenerlas?**
- Solicitar al hotel que contacte con su representante de Octorate
- O contactar directamente con soporte de Octorate

---

## Configuración OAuth

### Datos para registrar la aplicación en Octorate:

```
Nombre de aplicación: Limpatex Gestión
URL de callback: https://gestionlimpatex.vercel.app/callback/octorate
Permisos requeridos: Lectura de reservas
```

### Flujo de Autorización OAuth 2.0

1. **Generación de enlace de autorización**
   ```
   https://admin.octorate.com/octobook/identity/oauth/authorize
     ?response_type=code
     &client_id={CLIENT_ID}
     &redirect_uri=https://gestionlimpatex.vercel.app/callback/octorate
     &scope=openid
   ```

2. **El hotel hace clic en el enlace** → Autoriza la aplicación (solo una vez)

3. **Octorate redirige al callback** con un `code`

4. **Intercambio de código por tokens**
   ```
   POST https://admin.octorate.com/octobook/identity/oauth/token
   Content-Type: application/x-www-form-urlencoded
   
   grant_type=authorization_code
   &code={CODE}
   &client_id={CLIENT_ID}
   &client_secret={CLIENT_SECRET}
   &redirect_uri=https://gestionlimpatex.vercel.app/callback/octorate
   ```

5. **Respuesta con tokens**
   ```json
   {
     "access_token": "...",
     "refresh_token": "...",
     "expires_in": 3600
   }
   ```

6. **Almacenar `refresh_token`** para renovaciones automáticas

---

## Mensaje Preparado para Solicitar Credenciales

```
Asunto: Solicitud de credenciales OAuth para integración Octorate

Hola,

Estamos desarrollando una integración con Octorate para sincronizar 
automáticamente las reservas del hotel con nuestro sistema de gestión 
de limpiezas.

Para completar la integración, necesitamos que se registre nuestra 
aplicación en Octorate y nos proporcionen las siguientes credenciales:

- client_id
- client_secret

Datos técnicos para el registro:
- Nombre de aplicación: Limpatex Gestión
- URL de redirección (redirect_uri): https://gestionlimpatex.vercel.app/callback/octorate
- Propósito: Sincronización automática de reservas para gestión de limpiezas

Una vez tengamos las credenciales, les enviaremos un enlace de 
autorización que solo necesitan hacer clic una vez para activar 
la sincronización.

Gracias,
[Tu nombre]
```

---

## Arquitectura Técnica Propuesta

### Diferencias con Hostaway

| Aspecto | Hostaway | Octorate |
|---------|----------|----------|
| Método de sincronización | Polling (consulta periódica) | Webhooks (tiempo real) |
| Autenticación | API Key directa | OAuth 2.0 con refresh_token |
| Frecuencia | 3 veces al día | Instantáneo |

### Componentes a Implementar

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
├─────────────────────────────────────────────────────────────────┤
│  src/pages/callback/OctoRateCallback.tsx                        │
│  - Recibe código de autorización                                │
│  - Intercambia por tokens                                       │
│  - Almacena refresh_token en Supabase                          │
├─────────────────────────────────────────────────────────────────┤
│  src/pages/OctorateConfig.tsx (opcional)                        │
│  - Panel de configuración                                       │
│  - Mapeo de habitaciones a propiedades                         │
│  - Estado de conexión                                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     EDGE FUNCTIONS                               │
├─────────────────────────────────────────────────────────────────┤
│  supabase/functions/octorate-webhook/                           │
│  - Recibe eventos de reservas en tiempo real                    │
│  - Procesa: nueva reserva, modificación, cancelación           │
│  - Crea/modifica/cancela tareas de limpieza                    │
├─────────────────────────────────────────────────────────────────┤
│  supabase/functions/octorate-token-refresh/                     │
│  - Renueva access_token automáticamente                        │
│  - Ejecutar via cron cada 50 minutos                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE                                   │
├─────────────────────────────────────────────────────────────────┤
│  octorate_config                                                │
│  - access_token, refresh_token, expires_at                     │
│  - accommodation_id (ID del hotel en Octorate)                 │
├─────────────────────────────────────────────────────────────────┤
│  octorate_reservations                                          │
│  - octorate_reservation_id                                      │
│  - property_id (mapeo a nuestra propiedad)                     │
│  - arrival_date, departure_date                                │
│  - status, task_id                                              │
├─────────────────────────────────────────────────────────────────┤
│  octorate_room_mapping                                          │
│  - octorate_room_id → property_id                              │
│  - Mapeo de habitaciones Octorate a propiedades del sistema    │
└─────────────────────────────────────────────────────────────────┘
```

### Webhook Events a Procesar

```javascript
// Eventos que Octorate puede enviar:
{
  "event": "reservation.created",    // Nueva reserva → Crear tarea
  "event": "reservation.modified",   // Cambio de fechas → Modificar tarea
  "event": "reservation.cancelled",  // Cancelación → Cancelar tarea
}
```

---

## Checklist de Implementación

### Fase 1: Configuración Inicial
- [ ] Recibir `client_id` y `client_secret` de Octorate
- [ ] Almacenar credenciales en Supabase secrets:
  - `OCTORATE_CLIENT_ID`
  - `OCTORATE_CLIENT_SECRET`

### Fase 2: Autorización OAuth
- [ ] Crear página `/callback/octorate` para recibir código
- [ ] Implementar intercambio de código por tokens
- [ ] Crear tabla `octorate_config` para almacenar tokens
- [ ] Enviar enlace de autorización al hotel

### Fase 3: Configuración de Webhooks
- [ ] Crear edge function `octorate-webhook`
- [ ] Registrar webhook en panel de Octorate
- [ ] Implementar verificación de firma de webhooks

### Fase 4: Mapeo de Habitaciones
- [ ] Obtener lista de habitaciones del hotel via API
- [ ] Crear interfaz para mapear habitaciones → propiedades
- [ ] Crear tabla `octorate_room_mapping`

### Fase 5: Procesamiento de Reservas
- [ ] Crear tabla `octorate_reservations`
- [ ] Implementar lógica de creación de tareas
- [ ] Implementar modificación de tareas por cambios
- [ ] Implementar cancelación de tareas

### Fase 6: Mantenimiento
- [ ] Implementar renovación automática de tokens
- [ ] Crear logs de sincronización
- [ ] Panel de estado y errores

---

## Endpoints de API Octorate Relevantes

### Documentación Oficial
- **API Principal:** https://api.octorate.com/connect/redocly.html
- **Webhooks:** https://api.octorate.com/connect/redocly.html#tag/Webhook-Subscriptions

### Endpoints Clave

```
# Obtener reservas
GET /api/v3/reservations
Authorization: Bearer {access_token}

# Obtener habitaciones/unidades
GET /api/v3/accommodations/{id}/rooms
Authorization: Bearer {access_token}

# Configurar webhook
POST /api/v3/webhooks
Authorization: Bearer {access_token}
{
  "url": "https://qyipyygojlfhdghnraus.supabase.co/functions/v1/octorate-webhook",
  "events": ["reservation.created", "reservation.modified", "reservation.cancelled"]
}
```

---

## Notas Importantes

1. **Seguridad:** Los tokens OAuth deben almacenarse cifrados en Supabase secrets, no en el código.

2. **Refresh Token:** A diferencia de Hostaway, Octorate usa OAuth con refresh_token que debe renovarse antes de expirar.

3. **Webhooks vs Polling:** Octorate recomienda webhooks para sincronización en tiempo real, lo cual es más eficiente que el polling de Hostaway.

4. **Mapeo de Habitaciones:** Será necesario crear una interfaz para que el usuario mapee las habitaciones de Octorate a las propiedades existentes en el sistema.

5. **Compatibilidad:** Esta integración debe coexistir con Hostaway, permitiendo que diferentes clientes usen diferentes channel managers.

---

## Contacto y Soporte

- **Soporte Octorate:** support@octorate.com
- **Documentación API:** https://api.octorate.com/connect/redocly.html

---

*Documento creado: Diciembre 2024*
*Última actualización: Pendiente de credenciales*
