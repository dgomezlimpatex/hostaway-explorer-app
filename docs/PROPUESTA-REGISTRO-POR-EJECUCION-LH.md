# Propuesta: registro por ejecución de Little Hotelier (NO aplicada)

Estado: **propuesta para revisión**. No hay migración, función, cambio del ejecutor ni escritura nueva en este
repositorio. Aplicarla exige autorización específica de Dani (esquema, función y cambio del ejecutor local).

## Por qué hace falta (qué se comprobó en el código, sin ejecutar nada)

Ejecutor local (`codex_little_hotelier_sync_runner.py` + `little_hotelier_sync.py`, solo se leyó el código):

- Cada pasada hace una petición por **cada** reserva encontrada, cambie o no (`send_batch`).
- Estados locales: `ok`, `no_reservations`, `auth_expired`, `auto_login_failed`, `http_error`, `network_error`,
  `parse_error`, `send_error`, `config_error`, `unknown_error`. El resumen (inicio, fin, estado, encontradas,
  enviadas, errores, mensaje) se guarda en un `lh_sync_state.json` **local** y, solo si el ejecutor tiene
  `SUPABASE_URL` configurado, en la tabla `private_lh_integration_state` (clave `little_hotelier_sync_state`).
  Esa tabla no está en el repositorio ni se sabe si existe, si se escribe o si la app puede leerla.
- Con **cero reservas** (`no_reservations`) o un fallo **antes del envío** (sesión caducada, red, HTTP, lectura de
  la página, configuración) no se envía ninguna petición: no llega nada a la base de datos. El validador de Codex
  exige `encontradas > 0`, `enviadas = encontradas`, `errores = 0` y estado `ok`.
- Una petición que no llega al receptor (red) tampoco deja rastro.

Receptor vigente (`little-hotelier-sync` v84, según `supabase/production-snapshot/`):

- Solo autentica, valida los campos mínimos y llama a la función SQL `lh_apply_reservation_atomic`. **No escribe en
  `lh_sync_logs` por sí mismo.** Los rechazos 401/400 y los fallos de la función solo van a la consola de la función.
- La definición SQL de `lh_apply_reservation_atomic` no está en el repositorio (solo su nombre en
  `supabase-migraciones-aplicadas.json`, migración `20260906215711`). **No se puede demostrar desde el código si la
  función escribe `lh_sync_logs`**, ni qué contiene cada fila, ni si una reserva sin cambios deja fila. El código
  antiguo del repositorio (`supabase/functions/little-hotelier-sync/index.ts`, ya no desplegado) sí escribía una fila
  por petición, con su carga completa, también en los fallos 400 y 500.
- Para saberlo hay que leer la función desplegada o una agregación de solo lectura de `lh_sync_logs` en
  producción: ambas requieren autorización específica.

Consecuencias para el panel (ya reflejadas): `lh_sync_logs` solo puede entenderse como **eventos de reserva**, nunca
como el registro de una pasada. El panel no puede mostrar la ejecución, ni distinguir «no se ejecutó» de «no
encontró reservas» o «falló antes de enviar», ni saber si la pasada fue manual (solo infiere «fuera de horario»).
La sede tampoco figura en los eventos; en el código antiguo `lh_reservations.sede_id` se rellenaba con la sede del
primer mapeo encontrado, así que el panel deduce la sede del mapeo de cada habitación y de su propiedad.

## Propuesta

Una fila por ejecución, escrita por el propio ejecutor al terminar (también cuando termina por error o sin
reservas), con el mismo patrón que ya usa Smoobu (`smoobu_sync_runs` escrita por una función con su clave propia).

```text
public.lh_sync_runs                    -- lectura: admin/gestor (RLS); escritura: solo el rol de servicio del backend
  id                 uuid  pk
  run_key            text  unique      -- idempotencia: <slot Madrid ISO | 'manual:<uuid>'>
  trigger            text              -- 'scheduled' | 'manual'
  scheduled_slot     timestamptz null  -- hora esperada que se atiende (09:00/14:00/20:00 Madrid)
  started_at         timestamptz
  finished_at        timestamptz null  -- null = en curso; con started_at antiguo = atascada
  status             text              -- ok | no_reservations | auth_expired | auto_login_failed |
                                       -- http_error | network_error | parse_error | send_error |
                                       -- config_error | unknown_error | timeout
  reservations_found int
  sent_ok            int
  send_errors        int
  error_summary      text null         -- ya depurado, <= 200 caracteres, sin datos de huéspedes
  runner_version     text null
```

Escritura en dos pasos para ver «en ejecución»: al empezar (`started_at`, sin `finished_at`) y al terminar
(`finished_at`, estado y contadores). Si el proceso muere, queda una fila abierta que el panel enseña como atascada.

Ejemplo sintético (no son datos reales):

```json
{ "run_key": "2026-10-17T14:00", "trigger": "scheduled", "scheduled_slot": "2026-10-17T12:00:00Z",
  "started_at": "2026-10-17T12:00:09Z", "finished_at": "2026-10-17T12:01:41Z", "status": "ok",
  "reservations_found": 28, "sent_ok": 28, "send_errors": 0, "error_summary": null }
{ "run_key": "2026-10-17T20:00", "trigger": "scheduled", "scheduled_slot": "2026-10-17T18:00:00Z",
  "started_at": "2026-10-17T18:00:07Z", "finished_at": "2026-10-17T18:00:52Z", "status": "auth_expired",
  "reservations_found": 0, "sent_ok": 0, "send_errors": 0, "error_summary": "Sesión caducada" }
```

Con esa tabla el panel pasaría a distinguir programación (horario), ejecución (fila con inicio y fin) e importación
confirmada (`ok`, `encontradas > 0`, `enviadas = encontradas`, `errores = 0`), mostraría ejecuciones manuales con
evidencia real y dejaría de inferirlas. Cambios necesarios, todos con autorización específica:

1. Migración con la tabla, permisos explícitos, RLS activado y política de lectura para administración.
2. Función pequeña de informe con autenticación propia (como `smoobu-sync-report`), sin leer ni devolver datos de
   reservas, o bien exponer de forma legible la tabla `private_lh_integration_state` si ya se está escribiendo.
3. Cambio del ejecutor para informar al empezar y al terminar (incluye una ejecución manual).
4. Después, en el panel: leer `lh_sync_runs` en lugar de agrupar eventos de `lh_sync_logs`.

Riesgos: es un cambio en el ejecutor que corre en producción y toca el flujo de reservas; el informe debe ser
«mejor esfuerzo» (si falla el informe, la pasada continúa) y nunca bloquear el envío.
