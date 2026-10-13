# Corrección previa al arranque de inventario de lavandería

Cuando una ruta V2 confirma entrega o recogida, el handler publicado v83 llama
directamente a `process_laundry_route_inventory_event` y después guarda el tracking
por separado. El interruptor `laundry_route_inventory_enabled` no interviene en
esa ruta de ejecución. Un fallo del segundo guardado puede dejar el stock cambiado
y la entrega sin confirmar.

La corrección consulta el ajuste de la sede. Apagado o ausente, conserva tracking
e historial sin movimiento físico. Una lectura fallida no confirma nada. Encendido,
usa `process_laundry_route_inventory_and_tracking`, ya existente: comprueba el
ajuste bajo bloqueo y registra stock, tracking e historial en una transacción.
El handler no repite tracking ni el evento de la persona en este último caso.
La comprobación estricta de Deno también requiere usar listas vacías cuando las
listas de bolsas del tipo unión son opcionales; en rutas válidas no cambia contenido.

## Validación

```text
node scripts/laundryLaunchRouteWorkflowTest.mjs
node scripts/laundryLaunchCycleAuditTest.mjs
node scripts/laundryLaunchLintCheck.mjs
node scripts/inventorySimplificationTest.mjs
node scripts/inventorySimplificationBrowserTest.mjs
node scripts/laundryReceiptDatabaseTest.mjs
node scripts/laundryReceiptDiscardsTest.mjs
node scripts/laundryReceiptBrowserTest.mjs
npm run build
```

El handler desplegado completo se ejecuta con módulos compartidos reales y todas
las lecturas/escrituras simuladas. La prueba reproduce el fallo y comprueba 17
peticiones de la corrección. Una segunda prueba ejecuta las definiciones SQL leídas
el 13/10/2026 en PGlite con cantidades, identidades y sesiones inventadas: 13
comprobaciones de contratos existentes y huecos del circuito. No llama a producción.
Las demás pruebas verifican inventario, recepción y descartes, móvil/escritorio,
reintentos, pérdida de respuesta, Excel e historial con red externa simulada.

Build y tipos Node correctos. Tipos de aplicación: 102 diagnósticos previos; no
se cambia `src`. Lint: 1 error heredado del handler desplegado, ningún diagnóstico
nuevo. `deno check --node-modules-dir=none --no-config --no-lock` del paquete correcto.
No se comprueba concurrencia nativa PostgreSQL ni proveedores externos reales.

## Alcance de publicación pendiente

Requiere autorización específica de Dani y la reserva de turno descrita en
`docs/ENTREGA-AUTOMATICA.md`: cambia una Edge Function con acceso a datos reales.
No usar la ruta automática ordinaria ni declarar esos efectos como falsos.

Después de autorizar: actualizar base y comparar el paquete desplegado, repetir
pruebas pertinentes, reservar turno, desplegar únicamente `laundry-route-workflow`
con sus tres módulos compartidos sin cambios y el `verify_jwt=false` vigente.
No aplicar migraciones, cambiar ajustes, cargar aperturas, activar stock, cambiar
PIN/enlaces, configurar crons ni enviar correos de prueba. No redesplegar otras
funciones. Verificar versión/hash y seguir la incorporación/publicación protegida.
Si la función o main cambian mientras se espera, reconciliar y volver a comprobar.

## Circuito completo pendiente

Este parche corrige el uso del interruptor y el guardado conjunto; no activa ni
completa la reserva de limpia, destino compartido/directo, cambio de lencería,
lotes de lavado y cierre de la recepción móvil. La recepción pública suma limpia
y registra descartes, pero no cierra la sucia pendiente. El RPC de recepción
cerrada es otra vía: usar ambas para el mismo lote duplicaría la ropa aceptada.

La activación necesita una única identidad para esos lotes, recuentos físicos,
movimientos por diferencias, piloto acotado y pruebas de dos ciclos consecutivos.
El ajuste actual es por sede; no basta para pilotar una sola propiedad.
Los informes y hojas con ubicaciones/códigos operativos se conservan fuera del
repositorio público, en el archivo de trabajo privado de Dani.
