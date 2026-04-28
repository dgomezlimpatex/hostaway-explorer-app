
# Ampliación del sistema de alertas de reservas de 1 noche

## Cambios solicitados

1. **Más destinatarios**: además de `dgomezlimpatex@gmail.com`, enviar también a:
   - `Danielfernandezlimpatex@gmail.com`
   - `Vicentelimpatex@gmail.com`
2. **Ventana temporal ampliada**: alertar de cualquier reserva de 1 noche cuyo **checkout caiga en los próximos 30 días** (hoy incluido), no solo mañana.

## Qué se va a modificar

### 1. `supabase/functions/avantio-sync/reservation-processor.ts` — método `checkAndSendOneNightAlert`

- Mantener los filtros existentes:
  - `reservation.nights === 1`
  - Estado confirmado (excluir `REQUESTED`, `PENDING`, `TENTATIVE`, `CANCELLED`, etc.)
- **Cambiar el filtro de fecha**: en vez de comparar `departureDate === mañana`, comprobar que `departureDate` está dentro del rango `[hoy, hoy + 30 días]` en zona horaria Europe/Madrid.
- Mantener la **deduplicación dura** existente vía `avantio_alert_log` con clave única `(alert_type='one_night', property_id, reference_date=departureDate)` — esto sigue garantizando 1 sola alerta por propiedad+checkout aunque la reserva se vea en varios syncs durante 30 días.
- Ajustar el log: "Reserva de 1 noche detectada con checkout en X días".

### 2. `supabase/functions/send-one-night-alert/index.ts` — destinatarios y asunto

- Cambiar el array `to` de Resend para incluir los **3 destinatarios**:
  ```
  ['dgomezlimpatex@gmail.com',
   'Danielfernandezlimpatex@gmail.com',
   'Vicentelimpatex@gmail.com']
  ```
- Mantener el contenido HTML actual (tarjeta naranja con propiedad, huésped, fechas, etc.).
- Pequeño ajuste opcional en el subtítulo del header: "Checkout próximo — Acción requerida" en lugar de "Checkout mañana", ya que ahora puede ser cualquier día dentro del rango de 30 días. La fecha exacta sigue apareciendo destacada en el cuerpo y en el asunto.

### 3. Despliegue

Desplegar ambas Edge Functions tras los cambios:
- `avantio-sync`
- `send-one-night-alert`

## Lo que NO cambia

- Sigue ejecutándose dentro del cron de sync de Avantio (4 veces al día).
- Sigue ignorando reservas no confirmadas.
- Sigue usando `avantio_alert_log` con su índice único → no habrá emails duplicados aunque la misma reserva se procese muchas veces durante 30 días.
- Si el envío de email falla, sigue habiendo rollback del log para permitir reintento.
- El remitente sigue siendo `Limpatex Alertas <alertas@limpatexgestion.com>`.

## Consideración sobre el volumen

Al ampliar la ventana de 1 día a 30 días, **la primera ejecución tras desplegar** podría enviar más alertas de golpe (todas las reservas de 1 noche confirmadas en los próximos 30 días que aún no estén en `avantio_alert_log`). Después se estabiliza: solo se enviarán emails cuando aparezcan **nuevas** reservas de 1 noche en el rango.

¿Confirmas que procedemos así?
