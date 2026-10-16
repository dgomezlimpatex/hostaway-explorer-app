# Preparación y registro automático del reparto

Petición de Dani del 16/10/2026: retirar «Recogida y entrega» de los enlaces; las bolsas preparadas deben contar como entregadas y recogidas. Concretó el momento: **«el día de reparto a las 17:00»**. Este documento describe el cambio y su revisión; la publicación se comprueba por separado.

## Comportamiento

- El enlace solo muestra bolsas pendientes para la ruta actual y después para la siguiente, conservando material, vista por edificios y bloqueo de tres segundos.
- Preparar conserva su operación actual: reserva la lencería del circuito completo; los consumibles/modo provisional conservan el descuento que ya se hacía al preparar. No se descuenta dos veces.
- La fecha de reparto procede de `deliveryDate` o `nextDeliveryDate` del enlace según los días de servicio asociados. No se sustituye por la fecha de la limpieza ni por la fecha de preparación.
- A las 17:00 de Europe/Madrid se registra automáticamente entrega y recogida. Un proceso en PostgreSQL comprueba los vencimientos cada minuto, incluso con la página cerrada. El cambio de horario está cubierto. Si se perdió una ejecución o la bolsa se prepara tarde, se procesa en el siguiente minuto disponible.
- En el circuito completo la limpia pasa del central al trastero/propiedad y se recoge la sucia registrada en ese momento según el modo configurado. No se inventa sucia que aún no se ha generado. El modo provisional/solo seguimiento no mueve lencería otra vez ni inventa un recuento de sucia.
- Se conserva la persona que preparó. Las confirmaciones automáticas se identifican como automáticas, no como pulsaciones del repartidor.
- Una cancelación, cambio de fecha/contenido/destino o fallo contable detiene la operación y deja una incidencia administrativa. Entrega y recogida son una transacción: un fallo no deja movimientos parciales. Un fallo bloqueado requiere revisión, no se reintenta ciegamente.
- Se adoptan las bolsas ya preparadas para hoy o rutas futuras. No se completan repartos históricos. La cola conserva cada preparación/generación y sus resultados.

## Paquete y permisos

Migración única: `20261016132409_laundry_scheduled_route_completion.sql`. Añade cola privada, trigger al confirmar preparación, funciones internas y un único trabajo `laundry-prepared-route-completion`. Las funciones y la tabla nuevas no tienen acceso para `anon`, `authenticated` ni `service_role`; RLS activado, sin políticas permisivas. Solo el propietario PostgreSQL ejecuta el proceso; el trigger encola dentro de la preparación ya validada. No altera permisos existentes ni funciones de preparación/consumo previas. No requiere publicar Edge Functions.

La activación implica crear el trabajo programado y registrar su cola inicial en Supabase producción; la entrega usa la reserva revisada del proyecto. No se usa la ruta automática de cambios sin efectos sobre datos. No hay pruebas con escrituras reales.

## Revisión y pruebas

- `node scripts/laundryScheduledCompletionTest.mjs`: 15 escenarios con la migración exacta en PGlite aislado. Frontera de las 17:00, siguiente ruta, verano/invierno, idempotencia, cambio de fecha, cancelación, dotación, entrega manual previa, propiedad sin trastero, fallo atómico, incidencia/reconfirmación, modo provisional y solo seguimiento, permisos y adopción sin histórico.
- `LAUNDRY_NATIVE_ROOT=<runtime desechable>` y `node scripts/laundryScheduledCompletionNativeTest.mjs`: PostgreSQL nativo local con conexiones independientes, dos ticks simultáneos y una preparación en curso. Una sola entrega/recogida, sin deadlock, grants reales comprobados. Base sintética eliminada al terminar; nunca acepta URL de producción.
- `node scripts/laundryPreparationCooldownBrowserTest.mjs`: componente real a 320/390/1100 px, red bloqueada, urgentes y siguientes, material, edificios, guardado lento/fallo y bloqueo de tres segundos; sin botones de reparto.
- `node scripts/laundryCycleRouteBrowserTest.mjs`: validación real de cantidades y ausencia de controles/peticiones manuales con inventario activo e inactivo.
- Build, tipos raíz/Node y lint focalizado correctos. Tipos reales de aplicación: los mismos 102 diagnósticos previos, sin nuevos.

## Preflight y comprobación de publicación

Lectura previa del 16/10: PostgreSQL 17.4, pg_cron disponible, ningún job ni tabla con los nombres nuevos, motores antiguos de ruta apagados. La Edge Function de ruta está en v86 y no cambia. Funciones de las que depende el circuito conservan estas huellas `md5(pg_get_functiondef(oid))`:

| Función | Huella |
| --- | --- |
| laundry_cycle_route | 81ba0bd2c8d5f2e16e24b9099cd32f77 |
| laundry_cycle_lines | 7707b11bf2bf1a4e7db2e1e3ed6cde9d |
| laundry_cycle_dirty_lines | 74ee71a27dc9bb5a6333e2810071f91a |
| upsert_laundry_route_preparation_checked | 1111e23ae42c8d8e4abb98bc9736530d |
| apply_stock_bag_consumption | e651fb47af0474c6e5a4aa42b1c2cf1e |

Antes de aplicar, refrescar preflight y turno protegido. Después: comprobar historial de migración, un solo cron activo, permisos/RLS, cola limitada a hoy/futuro, horas locales 17:00 y ausencia de movimientos durante la instalación antes del vencimiento. La ejecución real de las 17:00 solo se confirma con el historial del job y sus registros; las pruebas sintéticas no la sustituyen. Verificar workflow, commit, ambos dominios y assets antes de anunciar publicación.

Si falla una operación, revisar `laundry_scheduled_completions` y la incidencia `scheduled_route_failed` en el circuito de inventario. No repetir escrituras ni revertir stock automáticamente. Para detener futuras ejecuciones se desactiva únicamente este cron; se conserva la cola y el historial. La reversión del frontend no deshace movimientos ya registrados.
