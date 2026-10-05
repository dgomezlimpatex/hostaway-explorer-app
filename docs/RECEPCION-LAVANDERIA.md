# Recepción diaria de ropa limpia

Implementación completa preparada en `codex/laundry-daily-receipts-20261005`, sobre la base `08a3990`. **No está activada en producción.** No se ha aplicado SQL, publicado la app, desplegado funciones ni enviado correos reales.

## Uso

1. Administración abre **Inventario → Lavandería → Recepciones de ropa limpia** (`/inventory/laundry/receipts`). Selecciona un almacén central, asocia los nueve campos a productos existentes y autoriza empleados de reparto activos. No se crean productos ni saldos iniciales automáticamente.
2. Copia el enlace fijo `/recepcion-lavanderia/:token`. Podrá usarse después en un QR/NFC. El enlace necesita siempre el PIN individual del empleado habilitado en REGISTRO/reparto; no concede acceso por sí solo.
3. Ruta inicia o continúa el recuento del día de Madrid. Introduce tandas por material, pulsa Añadir y guarda las observaciones. Los borradores se comparten entre móviles; cada operación guarda empleado, cantidades y fecha.
4. Al confirmar se suma ropa limpia al almacén y se encarga el Excel para `dgomez@limpatex.com` y `geisha@limpatex.com`. Las correcciones se vuelven a confirmar y ajustan solo la diferencia.
5. El Excel contiene las nueve cantidades recibidas acumuladas del día, almacén, fecha, versión, empleado y observaciones. No contiene existencias globales. Una versión posterior sustituye a la anterior de ese mismo día y almacén.

Solo se cuenta ropa limpia aceptada. Las incidencias y prendas rechazadas se describen en observaciones, sin añadirlas a las cantidades. La gestión física de ropa sucia/rechazada y el cotejo de albaranes no se modifican.

## Garantías y decisiones

- Un recuento por almacén/día, con versiones confirmadas inmutables. Los productos quedan fijados al iniciar el primer recuento para conservar la correspondencia del historial.
- Las sumas se aplican sobre el saldo vigente del borrador. Correcciones, deshacer, observaciones y confirmación requieren la revisión esperada; un cambio concurrente pide revisar el total.
- Bloqueo transaccional del enlace/recuento y de los saldos de producto en orden estable. La confirmación guarda versión, movimientos y correo pendiente en una sola transacción. Cualquier stock negativo revierte todo.
- Las cantidades son enteros entre 0 y 999.999.999. No hay subdivisiones por tamaño. No se puede confirmar la primera recepción sin ninguna prenda; una corrección posterior puede reducirla a cero si el stock permite la diferencia.
- Cada operación tiene un UUID persistido en el móvil antes de enviarla. Una respuesta perdida se recupera con ese mismo identificador, incluso tras recargar. La operación pendiente conserva su día y empleado; no se atribuye a quien entre después con otro PIN.
- Los campos de una tanda aún no añadida no cuentan como guardados. Se bloquea la confirmación mientras haya cantidades escritas sin añadir u observaciones sin guardar.
- El enlace abre hoy; los borradores antiguos conservan su fecha y aparecen para retomarlos. La consulta compartida se actualiza cada ocho segundos.
- Se reutilizan `laundry_route_workers` y `verify_laundry_route_worker_pin`. No se modifica el acceso existente de reparto. Las sesiones de recepción son independientes, duran doce horas y se invalidan al cambiar el PIN, dar de baja al empleado, modificar permisos, deshabilitar o rotar el enlace.
- Administración necesita rol admin/manager y acceso a la sede del almacén. Las tablas nuevas tienen RLS y no conceden acceso directo a `anon` ni `authenticated`; los RPC de mutación solo se conceden a `service_role`. La Edge Function valida PIN/sesión o usuario privilegiado antes de llamar a ellos.

## Correo y recuperación

`laundry-receipts` envía inmediatamente después de confirmar. La aceptación por Resend se registra como **aceptado por el proveedor**, sin afirmar que llegó al buzón. Si el envío falla, la recepción permanece confirmada y el correo queda pendiente/error. Hay reintento manual desde ruta y administración, sin tocar stock.

El recuperador procesa hasta cinco correos por llamada, con lease de tres minutos y hasta ocho intentos automáticos con espera creciente. El reintento manual permite otro intento dentro de la ventana segura. Se conserva una clave de idempotencia por versión y el mismo contenido de mensaje/Excel. Resend conserva esas claves durante [24 horas](https://resend.com/docs/dashboard/emails/idempotency-keys); los reintentos se detienen a las 23 horas del primer intento y pasan a revisión por administración para evitar duplicados tras expirar esa protección. Las sesiones, PIN y claves del proveedor no se registran en los logs.

El remitente preparado es `APP GESTIÓN LIMPATEX <alertas@limpatexgestion.es>`, el dominio utilizado por los correos existentes de la app. Se reutiliza `RESEND_API_KEY` exclusivamente en servidor.

## Pruebas reproducibles

```powershell
npm ci
npm run test:laundry-receipts
npm run build
npm run test:laundry-receipts:browser
npx tsc --project tsconfig.app.json --noEmit --pretty false
npx tsc --project tsconfig.node.json --noEmit --pretty false
npx deno check --node-modules-dir=none --no-lock supabase/functions/laundry-receipts/index.ts
```

Las pruebas SQL ejecutan **la migración exacta** en PostgreSQL WASM/PGlite con contratos previos sintéticos. Cubren acceso, bloqueos de PIN, dos empleados, nueve materiales con cientos de unidades, reintentos, correcciones, reversión por stock negativo, días pendientes, RLS/grants, leases y revocación de sesiones. El verificador de PIN previo es un fixture; no se altera ni se prueba con PIN reales.

Las pruebas Edge usan el handler real con un adaptador local de base de datos y Resend simulado. Comprueban permiso, correo fallido/reintentado, contenido idéntico, destinatarios, lectura de un XLSX real y observaciones que no se convierten en fórmulas.

La prueba de navegador usa la compilación real de la app en móvil/escritorio, intercepta todas las peticiones externas y ejecuta el handler contra esa base aislada. Incluye login, sumas, confirmación, descarga de Excel, respuesta perdida, recarga, correcciones, otro acceso al recuento, configuración de almacén y vista administrativa. No hace escrituras ni consultas desde el navegador al backend real.

Estas pruebas no demuestran concurrencia nativa entre conexiones PostgreSQL independientes, autenticación Supabase desplegada ni aceptación real de Resend. Esas comprobaciones forman parte de la activación autorizada.

### Resultado de la comprobación local del 05/10/2026

- Compilación de producción correcta.
- 17 grupos SQL correctos; pruebas del handler/correo correctas con proveedor simulado.
- Recorrido de navegador móvil y escritorio correcto, incluida configuración e historial de administración, descarga de Excel y recuperación de una respuesta perdida.
- Tipos reales de aplicación: los mismos 102 diagnósticos que la base, sin diagnósticos añadidos. Tipos Node y comprobación Deno de la función correctos.
- Lint de los archivos de aplicación modificados y `git diff --check` correctos. PGlite se añade únicamente como dependencia de desarrollo para las pruebas aisladas.
- El build emite avisos de CSS, Browserslist y tamaño de chunks; no bloquean la compilación. No se afirma que el conjunto global de TypeScript esté libre de errores.
- Cambios conservados en la rama local de esta tarea, sin commit/push, PR ni publicación. Las demás copias y sus índices no se han modificado.

## Activación — requiere autorización específica

1. Reconciliar la rama con GitHub/main y la fuente vigente de producción. Preservar trabajo ajeno y comprobar ambos dominios. Esta función **no pasa por la cola automática de presentación** ni se debe etiquetar como presentación.
2. Verificar en lectura las tablas stock/PIN y dependencias actuales. El 05/10 se comprobaron sus columnas y las funciones de inventario: el stock limpio central procede de `stock_levels`; no se usa `inventory_*`. No aplicar paquetes anteriores de inventario ni el circuito físico pendiente del 02/10.
3. Aplicar únicamente `supabase/migrations/20261005164100_laundry_daily_receipts.sql`, revisada con la migración y las pruebas locales. No ejecutar `supabase db push` sobre todo el historial.
4. Desplegar únicamente la nueva función `laundry-receipts`, con sus tres archivos compartidos importados y `verify_jwt=false`. La autorización se valida dentro del handler. Comprobar que los secretos del proveedor ya existen y que el remitente está habilitado, sin imprimir sus valores.
5. Publicar el frontend mediante el circuito autorizado para cambios funcionales y verificar `gestionlimpatex.vercel.app` y `gestionlimpatex-limpatex.vercel.app`.
6. Configurar los productos y empleados desde administración. La persona responsable debe verificar las correspondencias de los nueve materiales y el almacén físico; el sistema no las adivina.
7. Para recuperación automática, provisionar en Vault `laundry_receipts_recovery_service_role` por un canal seguro y aplicar `scripts/activateLaundryReceiptRecovery.sql`. Verificar pg_cron/pg_net antes. Solo programa el nuevo job `laundry-receipt-email-recovery` cada cinco minutos; no modifica jobs existentes. La acción `drain` acepta exclusivamente la service role.
8. Con autorización para una recepción controlada y el correo real, comprobar PIN, persistencia, movimientos por diferencia, Excel y aceptación del proveedor. Acordar las unidades reales antes de confirmar: no inventar una entrada de stock productivo para probar. Verificar también sesiones/permisos y comportamiento con dos conexiones independientes.

Para detener el acceso, deshabilitar el enlace en administración. Para detener solo los envíos automáticos, desprogramar únicamente `laundry-receipt-email-recovery`. Un rollback del frontend no revierte entradas de stock; las correcciones deben conservar el historial y aplicarse por diferencia.
