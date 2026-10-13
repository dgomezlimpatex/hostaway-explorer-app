# Inventario simplificado — 13/10/2026

## Alcance de esta entrega

La entrada se organiza en Resumen, Almacén central, Mudas y reparto y Edificios. El catálogo, los informes, el historial y la gestión de ubicaciones quedan en Más. Los enlaces anteriores de lavandería y amenities siguen funcionando, centrados en el almacén central y filtrados por familia.

Simón Bolívar se identifica por nombre, o por el almacén principal/central inequívoco de la sede. Si hay ambigüedad se pide revisar las ubicaciones. Nunca se suman todos los trasteros al almacén central.

Los edificios abren plegados y filtrados por necesidades. Muestran las mudas vinculadas a limpiezas y los repuestos: edredones, almohadas y protectores. La ropa histórica permanece consultable por ubicación y no se convierte automáticamente en bolsas. El recuento recibe solo las líneas visibles; crear un producto toma como destino inicial la ubicación que se está consultando.

## Cálculos y estados

- Falta para preparar: necesidad pendiente superior al saldo registrado.
- Reponer reserva: tras cubrir lo pendiente no se alcanza la mayor de reserva mínima y deseada.
- Sin reserva definida: no hay necesidad ni reserva configurada. Cero no equivale a urgencia.
- Saldo negativo, consultas fallidas o contenido sin producto correspondiente: revisar; no se reemplazan por un cero tranquilizador.
- Cada tarea se cuenta una vez. Preparadas y entregadas no se incluyen de nuevo en por preparar.
- Una preparación no demuestra una entrega física. La entrega necesita fecha registrada, posterior a la preparación/anulación, y contenido coherente.
- Se respetan las cantidades personalizadas de cada propiedad y su activación heredada. Los cambios de contenido pasan a revisión.
- Hoy / 3 días / 7 días usan fechas de Madrid. Las consultas de tareas y preparación se paginan y se acotan a la sede; solo se leen campos necesarios, sin enlaces públicos ni tokens.

Los saldos continúan siendo saldos registrados, no una afirmación de disponibilidad física comprobada. La pantalla lo indica. Las mudas sin tarea futura activa y las reservas físicas no vinculadas a una tarea no se pueden reconstruir con certeza desde estos registros.

## Operaciones conservadas

Recepciones, descartes, correcciones, recuentos, ajustes, traslados y preparación siguen utilizando sus operaciones existentes. Esta entrega no ejecuta operaciones de negocio ni cambia SQL, funciones, permisos o automatismos. No mueve, borra ni corrige existencias antiguas.

La creación existente todavía genera líneas de stock para las ubicaciones activas. Esas líneas dejan de dominar la interfaz. Cambiar ese comportamiento persistente, introducir reservas físicas y unificar operaciones atómicas requiere revisar el circuito de datos por separado, no basta con ocultar filas.

## Activación física pendiente

Antes de presentar disponibilidad física garantizada o activar nuevos descuentos:

1. Confirmar cantidades reales de Simón Bolívar por producto y separar material suelto de bolsas ya preparadas.
2. Confirmar reservas mínimas/deseadas y el destino físico de cada edificio compartido.
3. Reconciliar ropa histórica de trasteros y bolsas sin tarea activa, sin borrarlas ni trasladarlas por inferencia.
4. Preparar y revisar el contrato de reserva, entrega, consumo, devolución, descarte y corrección: idempotencia por evento, aplicación por diferencia y transacción completa. Un fallo parcial no debe confirmar el movimiento.
5. Obtener autorización específica para migraciones, escrituras reales o activación de funciones Supabase; probar primero con un circuito acotado. El recuento físico lo aporta la operación, no se inventa a partir del código.

## Verificación

Pruebas locales de selección central, familias, reservas, herencia por propiedad, mudas duplicadas, cambios de contenido, entrega antigua, destinos compartidos, paginación y errores. Navegador con componentes reales y datos ficticios: cuatro páginas, filtros, búsqueda con tildes, secciones plegadas, alcance del recuento, móvil de 390 px y errores de consulta. Los diálogos de escritura se sustituyen en ese navegador por dobles; la lógica existente de recuento se comprueba con su prueba independiente.

Build, lint focalizado y tipos de Node comprobados. Los tipos de aplicación se comparan con la base: deuda anterior conservada, sin errores añadidos. Esquema de preparación/entrega contrastado con producción mediante consultas de metadatos de solo lectura. No se prueba guardando datos reales.
