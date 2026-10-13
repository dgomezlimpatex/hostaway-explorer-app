# Preparación y activación revisada

## Paquete

- `supabase/migrations/20261013160000_laundry_complete_cycle.sql`: tablas del circuito, aperturas absolutas, reservas, cambios por finalización, recogida/envío/recepción conjunta, historial, incidencias, RLS y permisos. Una transacción completa. No inserta sedes, recuentos, configuración ni activaciones.
- `supabase/functions/laundry-route-workflow/index.ts`: única Edge Function modificada. Usa la transacción del circuito cuando está activo; conserva el flujo anterior cuando falta el nuevo SQL o está apagado. Las dependencias desplegadas de `_shared` se conservan.
- `src/components/stock/LaundryCycleSetup.tsx`: preparación y operación desde la configuración actual, con borradores por sede/usuario y reintentos explícitos.
- Consulta de inventario: muestra saldo físico, reserva y disponibilidad por separado y usa cantidades canónicas por propiedad. Un fallo de lectura impide presentar saldos anteriores como actuales.
- La operación existente de recepción se conserva como `apply_laundry_receipt_operation_before_cycle`. La nueva envoltura mantiene versiones, cambios por diferencia, descartes, historial administrativo y outbox existente; añade el cierre del pendiente conjunto en la misma transacción. No añade destinatarios ni proveedor.

## Publicación técnica, todavía sin stock automático

AGENTS.md exige autorización específica para SQL/esquema, permisos y Edge Functions. La autorización anterior de PR #121 se limita a su corrección de reparto. Este paquete queda en PR borrador; no se entrega por la cola ordinaria ni se declaran falsos sus efectos reservados.

1. Actualizar base con `origin/main`, verificar producción, estado de la PR y dependencias actuales. Ejecutar la consulta de solo lectura `scripts/laundryCompleteCyclePreflight.sql`. Comparar las definiciones existentes con los contratos usados en pruebas, especialmente recepción v4 e historial administrativo. Si hay deriva, reconciliar y volver a comprobar; no reemplazar trabajo nuevo.
2. Revisar el commit exacto y obtener autorización concreta para esta migración, sus permisos y el despliegue de la función indicada. Reservar turno conforme a `docs/ENTREGA-AUTOMATICA.md` antes de cualquier operación productiva.
3. Con turno activo, aplicar únicamente la migración nueva. No ejecutar `db push`, migraciones históricas ni escrituras de pruebas. Comprobar objetos, grants/RLS y que no existe ninguna configuración activa.
4. Desplegar únicamente `laundry-route-workflow` con sus dependencias verificadas. No desplegar `laundry-receipts` ni todo `supabase/functions`.
5. Incorporar y publicar el candidato revisado mediante la reserva; comprobar ambos dominios canónicos y el workflow. Vercel y Supabase son estados distintos.
6. Probar lecturas con sesión administrativa real y PIN real en la ruta V2 y recepción, sin confirmar movimientos ni enviar correos. Las pruebas locales no prueban JWT/RLS del proveedor ni una bandeja de correo real.

## Apertura física y arranque

Requieren su propia autorización concreta: propiedades/sede/central, fecha de corte, cantidades contadas, operativa y activación. La publicación técnica no concede permiso para cargar stock.

1. Aplicar la operativa confirmada por Dani: toda la sucia acumulada se recoge hacia el almacén; los rechazos esperan allí apartados hasta un envío posterior. Configuración: `all`, `central`, `central`. Usar rutas V2 con PIN. Los enlaces clásicos no pueden confirmar movimientos de un circuito activo por fuera de su registro físico.
2. Validar dotaciones, herencias y productos de recepción. Contar el almacén completo, cada trastero compartido una vez, instalada/sucia por propiedad, sucia ya recogida que espera envío en el central, rechazada apartada, bolsas directas y pendiente conjunto. Las hojas privadas no se publican en GitHub.
3. Coordinar recuento y arranque en un momento sin preparación, reparto, limpiezas ni recepción entre ambos. Si la operación continúa o cambia el saldo, volver a comprobar. Terminar recepciones antiguas pendientes antes del recuento.
4. Guardar alcance y fecha futura sin limpiezas ya realizadas. Cargar cantidades desde la pantalla, comprobando cada categoría y responsable. La apertura sustituye cantidades; nunca las suma. Vincular las bolsas contadas existentes.
5. Comprobar con las personas responsables las aperturas y el recorrido completo antes de activar. Los casos de dos ciclos, parcial, rechazo para relavado, corrección y reintento se han probado localmente. Durante un piloto parcial registrar manualmente las salidas no incluidas; para automatización diaria del central, cubrir todas sus propiedades.
6. Activar el alcance autorizado y observar los dos primeros ciclos reales, revisando incidencias y diferencias tras cada ruta/recepción. La prueba local no sustituye esa observación. Mantener los motores anteriores apagados.

## Validación local reproducible

Sin credenciales ni datos reales:

```text
node scripts/laundryCompleteCycleTest.mjs
node scripts/laundryCompleteCycleBoundariesTest.mjs
node scripts/laundryLaunchRouteWorkflowTest.mjs
node scripts/laundryCompleteCycleBrowserTest.mjs
node scripts/laundryCycleAvailabilityBrowserTest.mjs
node scripts/laundryCycleRouteBrowserTest.mjs
node scripts/laundryPreparationCooldownBrowserTest.mjs
node scripts/inventorySimplificationBrowserTest.mjs
```

La prueba nativa adicional usa un PostgreSQL desechable en loopback, usuario `fixture`, puerto 55437 y `LAUNDRY_NATIVE_ROOT` explícito. Comprueba el directorio antes de crear/borrar su base y ejecuta dos conexiones independientes. No acepta URLs de Supabase ni variables de conexión de la app.

```text
node scripts/laundryCompleteNativeTest.mjs
```

Build, tipos Node, Deno y lint focalizado se verifican aparte. TypeScript de la aplicación tiene deuda previa: registrar diagnóstico completo antes/después y exigir que este cambio no añada errores, sin declarar un typecheck limpio por ejecutar solo el proyecto raíz.

## Contención

Antes de activar, no hay eventos físicos del nuevo circuito y sus llamadas delegan en el flujo anterior. Si falla la publicación, detener el turno, revisar los efectos parciales y reconciliar conforme a la reserva.

Después de cargar stock o activar, desactivar no deshace entregas, recepciones ni finalizaciones. No borrar tablas, reiniciar saldos ni reaplicar aperturas automáticamente. Detener movimientos, conservar eventos y recuentos, comparar cada ubicación y preparar una corrección explícita autorizada. Una reversión de frontend no revierte Supabase.

La ruta muestra las acciones de entrega/recogida únicamente cuando el servidor confirma el circuito activo. Envía la propiedad, fecha, generación y cantidades que vio la persona; cambios posteriores exigen recargar. El botón antiguo de completar un edificio entero se mantiene oculto en el circuito nuevo: la confirmación se hace por propiedad y cada movimiento es atómico. Los demás modos conservan su presentación anterior.
