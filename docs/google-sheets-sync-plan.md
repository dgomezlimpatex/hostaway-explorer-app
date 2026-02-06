# Plan de Sincronización Automática con Google Sheets

## Resumen

Crear una Edge Function que lea automáticamente las reservas desde un Google Sheets compartido y sincronice las tareas de limpieza correspondientes. Se ejecutará cada 5 horas entre las 07:00 y las 23:00.

---

## Prerequisitos

1. **Cuenta de servicio de Google**: Crear una cuenta de servicio en Google Cloud Console con acceso a la API de Google Sheets.
2. **Compartir el Sheets**: Compartir el Google Sheets con el email de la cuenta de servicio (permisos de solo lectura).
3. **Configurar secretos**: Añadir las credenciales como secretos en el proyecto (ver sección "Secretos necesarios").

---

## Frecuencia de Ejecución

Se configurarán 4 ejecuciones diarias vía `pg_cron`:

| Hora  | Descripción          |
|-------|----------------------|
| 07:00 | Primera del día      |
| 12:00 | Mediodía             |
| 17:00 | Tarde                |
| 22:00 | Última del día       |

---

## Estructura del Google Sheets

Las columnas del Sheets son las siguientes:

| Columna        | Descripción                              |
|----------------|------------------------------------------|
| BookingId      | Identificador único de la reserva        |
| Propiedad      | Código de la propiedad (ej: "APT-001")   |
| CheckIn        | Fecha de entrada del huésped             |
| CheckOut       | Fecha de salida (día de limpieza)        |
| NesCheckout    | Número de noches                         |
| Importe        | Importe total de la reserva              |
| EstadoReserva  | Estado (CONFIRMED, REQUESTED, etc.)      |

---

## Mapeo de Columnas: Sheets → Base de Datos

| Columna Sheets  | Campo BD (reservas)                      | Campo BD (tareas)                          |
|-----------------|------------------------------------------|--------------------------------------------|
| BookingId       | `booking_id` (identificador único)       | —                                          |
| Propiedad       | `property_code` → `properties.codigo`    | `property`, `propiedad_id`                 |
| CheckIn         | `check_in_date`                          | `check_in`                                 |
| CheckOut        | `check_out_date`                         | `date` (día de limpieza), `check_out`      |
| NesCheckout     | `nights`                                 | —                                          |
| Importe         | `amount`                                 | —                                          |
| EstadoReserva   | `status`                                 | `status` (solo CONFIRMED genera tarea)     |

---

## Tablas Nuevas

### 1. `sheets_reservations`

Almacena las reservas leídas del Sheets para control de sincronización.

| Campo            | Tipo                  | Descripción                                    |
|------------------|-----------------------|------------------------------------------------|
| `id`             | uuid (PK)             | Identificador interno                          |
| `booking_id`     | text (unique)         | BookingId del Sheets                           |
| `property_code`  | text                  | Código de propiedad tal como aparece en Sheets |
| `property_id`    | uuid (FK → properties)| Referencia a la propiedad resuelta             |
| `check_in_date`  | date                  | Fecha de check-in                              |
| `check_out_date` | date                  | Fecha de check-out                             |
| `nights`         | integer               | Número de noches                               |
| `amount`         | numeric               | Importe de la reserva                          |
| `status`         | text                  | Estado de la reserva (CONFIRMED, etc.)         |
| `task_id`        | uuid (FK → tasks)     | Tarea de limpieza asociada (nullable)          |
| `sede_id`        | uuid (FK → sedes)     | Sede de la propiedad                           |
| `last_seen_at`   | timestamptz           | Última vez que apareció en el Sheets           |
| `created_at`     | timestamptz           | Fecha de creación                              |
| `updated_at`     | timestamptz           | Fecha de última actualización                  |

### 2. `sheets_sync_logs`

Registro de cada ejecución de sincronización.

| Campo                      | Tipo         | Descripción                          |
|----------------------------|--------------|--------------------------------------|
| `id`                       | uuid (PK)    | Identificador                        |
| `sync_started_at`          | timestamptz  | Inicio de la sincronización          |
| `sync_completed_at`        | timestamptz  | Fin de la sincronización             |
| `status`                   | text         | success / error / partial            |
| `reservations_processed`   | integer      | Total de filas procesadas            |
| `new_reservations`         | integer      | Reservas nuevas creadas              |
| `updated_reservations`     | integer      | Reservas actualizadas                |
| `cancelled_reservations`   | integer      | Reservas canceladas                  |
| `tasks_created`            | integer      | Tareas creadas                       |
| `tasks_cancelled`          | integer      | Tareas canceladas                    |
| `errors`                   | text[]       | Lista de errores encontrados         |

---

## Lógica de Sincronización

### Crear (nueva reserva)
- La reserva aparece en el Sheets con `EstadoReserva = CONFIRMED`
- No existe en `sheets_reservations` (por `booking_id`)
- **Acción**: Crear registro en `sheets_reservations` + crear tarea de limpieza en fecha de CheckOut

### Actualizar (reserva existente modificada)
- La reserva ya existe en `sheets_reservations`
- Han cambiado las fechas (CheckIn/CheckOut) o el estado
- **Acción**: Actualizar registro en `sheets_reservations` + actualizar tarea asociada

### Cancelar (reserva eliminada o estado cambiado)
- Una reserva que estaba en `sheets_reservations` ya no aparece en el Sheets
- O el `EstadoReserva` cambió a algo distinto de CONFIRMED
- **Acción**: Marcar reserva como cancelada + cancelar tarea asociada

### Ignorar
- Reservas con `EstadoReserva = REQUESTED` u otros estados no generan tareas
- Se guardan en `sheets_reservations` para seguimiento, pero sin tarea asociada

---

## Edge Function: `sheets-sync`

**Archivo**: `supabase/functions/sheets-sync/index.ts`

### Flujo de ejecución:
1. Autenticación con Google vía cuenta de servicio (JWT)
2. Lectura del Sheets usando la API REST de Google Sheets v4
3. Para cada fila:
   - Resolver `property_id` buscando por `properties.codigo`
   - Verificar si ya existe en `sheets_reservations`
   - Aplicar lógica de crear/actualizar/cancelar
4. Detectar reservas que ya no aparecen en el Sheets (comparar `last_seen_at`)
5. Registrar log de sincronización en `sheets_sync_logs`

### Patrón de implementación:
Se seguirá el mismo patrón ya implementado en `hostaway-sync` (orchestrator, processor, logs), adaptado para Google Sheets como fuente de datos.

---

## Secretos Necesarios

| Secreto                              | Descripción                                              |
|--------------------------------------|----------------------------------------------------------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`       | Email de la cuenta de servicio de Google                  |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Clave privada de la cuenta de servicio (formato PEM)     |
| `SHEETS_SPREADSHEET_ID`             | ID del Google Sheets (extraído de la URL)                |
| `SHEETS_RANGE`                      | Rango de celdas a leer (ej: `Sheet1!A2:G1000`)          |

---

## Notas Adicionales

- La resolución de propiedades se hace por el campo `codigo` de la tabla `properties`, que debe coincidir exactamente con el valor de la columna "Propiedad" del Sheets.
- Si una propiedad no se encuentra, se registra un error en el log pero no se detiene la sincronización.
- Las tareas creadas seguirán el mismo formato que las generadas por Hostaway/Avantio, con los campos estándar de la tabla `tasks`.
