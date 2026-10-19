# Confirmación de bolsas con inventario estimado

Dani confirmó el 19/10/2026 que preparar físicamente la bolsa debe incorporar al
stock las prendas que faltaban en el saldo teórico. La ropa limpia recuperada
de propiedades no siempre figura en el inventario.

La función de rutas V2 conserva las validaciones de PIN, sede, enlace, fecha,
dotación y estado. Bajo los bloqueos existentes de sede y saldo, calcula para
cada textil: reservas de otras bolsas más contenido de la bolsa confirmada.
Si el saldo es inferior, lo aumenta solo hasta ese mínimo. Ejemplo: 11 unidades
registradas, 6 reservadas y 10 en esta bolsa producen un ajuste positivo de 5.

Cada incremento queda como movimiento `ajuste`, con cantidades anterior/nueva,
tarea, propiedad y motivo explícito de inventario estimado. El evento de
preparación conserva productos/cantidades ajustadas y trabajador responsable.
No se registra como recepción de lavandería ni compra. No reduce otras reservas.

La confirmación y sus ajustes son atómicos: un error posterior revierte todo.
Repetir una confirmación no vuelve a aumentar el saldo. La entrega continúa a
las 17:00 de la fecha de reparto con las reglas existentes. No cambia permisos,
cron, ropa sucia, consumibles ni bolsas históricas; no confirma bolsas de oficio.
La nueva regla se aplica a las preparaciones del circuito completo activo.

Validación aislada: `node scripts/laundryPreparedStockReconciliationTest.mjs`.
Cubre saldo insuficiente/cero/inexistente, reserva compartida, reintento,
entrega programada, PIN inválido, contenido obsoleto y rollback por falta de
consumibles. Antes de aplicar la migración se compara la función desplegada
con la base inspeccionada. Después se verifica su definición y permisos sin
preparar una bolsa real en nombre del trabajador.
