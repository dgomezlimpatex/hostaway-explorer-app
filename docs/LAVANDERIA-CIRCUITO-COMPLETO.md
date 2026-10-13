# Circuito diario de ropa

Implementación preparada, pendiente de publicación revisada y recuento físico. Este documento describe el nuevo circuito; no afirma que esté activo en producción.

## Operativa confirmada

- Preparáis bolsas por propiedad desde el almacén, donde la ropa limpia se guarda por tipología.
- La bolsa entregada espera en el trastero del edificio; donde no hay trastero, espera en la propiedad.
- El repartidor recoge toda la sucia acumulada en cada trastero o propiedad y la lleva al almacén. Desde allí la enviáis junta a lavandería.
- Lavandería devuelve la ropa junta y sin identificación de propiedad. La recepción cuenta prendas por tipología y vuelve a aumentar el limpio del almacén.
- Las prendas rechazadas quedan apartadas en el almacén y se devuelven a lavandería en un envío posterior.

La configuración para esta operativa es recogida completa, destino almacén y rechazada apartada en el almacén. Los otros modos preparados exigen selección explícita y no sustituyen lo confirmado por Dani.

## Uso diario

| Paso | Acción de la persona | Qué registra el sistema |
| --- | --- | --- |
| Preparar | Confirmar la bolsa en la ruta nueva con PIN | Reserva su contenido. Sigue físicamente en el almacén; deja de estar disponible para otra bolsa. |
| Entregar | Confirmar entrega | Resta del central y suma al único trastero del edificio. Sin trastero, registra la bolsa que espera en la propiedad. |
| Limpiar | Finalizar la limpieza como siempre, también offline | Una vez sincronizada la finalización, instala la bolsa entregada; la ropa anterior pasa a sucia. No descuenta limpia dos veces. |
| Recoger | Confirmar recogida | Traslada toda la sucia registrada de esa propiedad al almacén, pendiente de enviar. La instalada permanece instalada. |
| Enviar | Confirmar cantidades enviadas en Inventario → Configuración | Traslada las cantidades recogidas y las rechazadas devueltas a pendientes en lavandería, juntas por tipología. |
| Recibir | Contar y confirmar en la recepción móvil actual | Las prendas aceptadas entran en limpio y reducen lo pendiente. La devolución no se atribuye a propiedades ni a sus bolsas. |

Si una muda requiere 2 toallas, preparar reserva 2; entregar las transfiere; limpiar utiliza esas 2 y deja las 2 anteriores en sucia. Una recepción de 1 deja la otra pendiente. Las reservadas están incluidas en el saldo limpio físico: no se suman como unidades adicionales.

## Antes de empezar

En Inventario → Configuración, el bloque «Circuito completo de lavandería» permite elegir sede, central, propiedades, primer día y recogida. «Seleccionar todas con lencería» respeta la herencia del cliente. Los edificios compartidos se cuentan completos y una sola vez.

Se cuentan limpia total por ubicación (incluidas bolsas), unidades ya embolsadas, instalada por propiedad, sucia que sigue en cada propiedad/trastero, sucia ya recogida que espera envío en el almacén, rechazada apartada en el central y pendiente en lavandería por tipología. También se cuentan las bolsas limpias que ya esperan en propiedades sin trastero. Cada prenda pertenece a una sola de esas categorías. Un campo vacío significa pendiente; cero exige comprobación.

Las bolsas anteriores se vinculan indicando si siguen en el central o ya están en el trastero/propiedad. Se comprueba físicamente su contenido; vincularlas no vuelve a descontar ropa. La activación exige categorías completas, bolsas anteriores vinculadas o deshechas, recepción con empleado activo y motores anteriores apagados.

## Incidencias

- Una cancelación no devuelve prendas automáticamente. «Confirmar bolsa deshecha» libera la reserva; «Confirmar devolución» registra la bolsa que realmente vuelve al central. Se conserva el historial y la ruta vuelve a mostrarla pendiente.
- Cambiar fecha, propiedad o dotación obliga a revisar la bolsa. Las cantidades entregadas se conservan tal como ocurrieron físicamente.
- Si falta entrega o apertura al finalizar, se conserva la limpieza y aparece un movimiento pendiente. Corregida la causa, se reintenta una vez; el identificador de la limpieza evita duplicados. Si faltó confirmar una entrega ya realizada, el administrador debe revisar y reabrir la tarea para registrarla con PIN antes de finalizar de nuevo.
- Rechazar una prenda para volver a lavarla no es una pérdida. Si el proveedor se la lleva inmediatamente, sigue pendiente en lavandería. Si queda apartada, pasa a rechazada en el central y vuelve a pendiente al confirmar el envío. Solo «Confirmar baja definitiva», con motivo y comprobación, la da de baja; también sirve para una prenda apartada que resulte inservible.
- Los reintentos después de pérdida de conexión conservan la misma operación. Las cantidades enviadas también comprueban el saldo que vio la persona, para evitar dos envíos del mismo recuento.
- Las recepciones confirmadas antes de la apertura ya están incluidas en el recuento absoluto. Se permiten sus aclaraciones, pero cambiar sus cantidades exige un recuento físico actual.

## Alcance

La automatización preparada controla lencería. No activa consumo genérico de otros productos, PMS, mensajería nueva ni la estimación de amenities.

Un piloto parcial comparte el almacén y la recepción con otras propiedades. Durante ese piloto, las salidas del resto deben registrarse manualmente y conciliarse; el saldo global no puede tratarse como automatizado si faltan esos movimientos. Para uso diario completo, hay que incluir todas las propiedades que abastece ese almacén y registrar todos sus envíos. Las recepciones que excedan lo pendiente generan incidencia, o se bloquean si se elige control estricto.

Recoger una sola muda usa la composición de la ropa realmente retirada en la limpieza anterior. Para este modo se exige empezar sin sucia antigua cuyo contenido por bolsa se desconoce. Recoger toda permite cargar el acumulado inicial contado.
