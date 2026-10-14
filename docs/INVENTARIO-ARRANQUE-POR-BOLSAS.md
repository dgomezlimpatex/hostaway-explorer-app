# Arranque diario con stock parcial

Este modo permite empezar con las entradas registradas y el contenido confirmado de las bolsas, aunque quede stock antiguo sin contar. Es independiente del circuito físico completo publicado anteriormente. No activa cantidades de ropa instalada, sucia o pendiente de lavandería sin recuento.

## Operación

- Administración calcula y revisa la apertura en Inventario → Configuración, eligiendo almacén central y primer día de registros.
- La ropa parte de las recepciones confirmadas y sus correcciones. Los consumibles parten de entradas manuales; un ajuste absoluto sustituye el saldo introducido anteriormente, no se suma como otra compra.
- Se resta el contenido confirmado desde el primer día. En bolsas anteriores se considera únicamente la variación conocida. Un detalle histórico ausente se muestra como pendiente y nunca se convierte en un cero físico.
- La activación concilia las existencias una sola vez y desactiva el descuento estimado por limpieza y las otras dos vías antiguas de consumo de esa sede. Una vista previa obsoleta se rechaza sin efectos parciales.
- Las siguientes preparaciones descuentan solo la diferencia de contenido. Repetir una confirmación, registrar una incidencia o cancelar la tarea no devuelve una bolsa al almacén.
- La entrega comprueba la versión exacta de la bolsa en la misma operación que registra el reparto. Una preparación y una entrega contradictorias no pueden guardarse juntas. La entrega no descuenta otra vez el almacén.
- Una bolsa realmente deshecha o devuelta se resuelve expresamente en Configuración. Solo entonces se recupera su material registrado; un reintento no duplica la devolución.
- Las recepciones nuevas suman y sus correcciones aplican diferencias. Las anteriores al inicio o incluidas en un recuento físico conservan sus versiones sin volver a sumar existencias; la exclusión queda en el documento de recepción.
- Un saldo parcial negativo indica que falta el stock previo. No demuestra una falta física ni genera una propuesta de compra. La preparación puede continuar mientras ese producto siga parcial.
- «Contar existencias» acredita material suelto del almacén, excluyendo bolsas preparadas. Las líneas vacías siguen pendientes; una cantidad coincidente también se acredita. A partir de ahí, una preparación que exceda el stock contado se bloquea.
- Los traslados se habilitan al cerrar el arranque provisional y abrir el circuito físico con su recuento por ubicación. El cierre exige contar todos los productos.

## Paquete de publicación revisada

Preparado para la cola con autorización específica; no aplicar a producción por el mero hecho de crear la PR.

1. Comprobar main/PR, CI, ambos dominios y revisión del head exacto. Reservar turno según `ENTREGA-AUTOMATICA.md` antes de cualquier operación productiva.
2. Volver a comparar las seis funciones reemplazadas con las definiciones productivas revisadas. Detenerse si hay deriva; no reemplazar cambios ajenos.
3. Aplicar únicamente `20261014173000_stock_bag_accounting.sql` y `20261014173100_stock_bag_estimated_cutover.sql`, en orden. No usar `db push` ni aplicar migraciones históricas.
4. Publicar solo `laundry-route-workflow`, conservando su autenticación de sesión/PIN y sus dependencias verificadas. La consulta de modo es privada para la función; no se concede a clientes públicos.
5. Incorporar el commit revisado y entregar Vercel al workflow reservado. Verificar los dos alias y los assets previstos. Las migraciones y la nueva interfaz, por sí solas, dejan el modo desactivado.
6. La interfaz nueva solo está disponible después de publicar. Si la activación está expresamente autorizada, preparar su registro operativo en una propuesta separada y reservar un nuevo turno después de cerrar la publicación del código. Con ese turno activo, obtener una vista previa productiva nueva desde la sesión administrativa de la aplicación, revisar sus saldos y confirmar su huella con una identidad de operación persistente. No reutilizar huellas de pruebas ni inventar `auth.uid()`.
7. Verificar configuración activa de la sede solicitada, existencias parciales, ausencia de doble consumo y permanencia del circuito físico completo apagado. No preparar bolsas ni introducir movimientos de prueba en producción.

La publicación cambia SQL, una Edge Function y la aplicación. La activación posterior concilia datos reales. Ambos alcances requieren autorización específica según AGENTS.md. Las recepciones mantienen su comunicación existente; no se añaden destinatarios, envíos de prueba ni notificaciones.

La autorización de Dani para publicar la PR #143 y activar el saldo provisional de Coruña desde el 8 de octubre de 2026 cubre esos dos pasos. La apertura queda acreditada por la operación administrativa persistida y su comprobación posterior, conservadas en el informe privado; no por esta documentación. No se incluyen existencias reales, códigos de propiedades ni identidades de trabajadores en el repositorio público.

## Verificación local

- SQL real preparado en PGlite: apertura, datos antiguos incompletos, diferencias de bolsas, reintentos, devoluciones, límites, permisos, recuentos y regresión del circuito físico.
- PostgreSQL nativo desechable: proceso estimado en vuelo frente a activación, doble activación, doble preparación, recepción simultánea, doble recuento y doble devolución.
- Navegador con SQL local: vista previa y confirmación deliberada, pérdida de respuesta tras guardar, recarga, reintento y recuento coincidente, móvil y escritorio.
- Handler Edge real: modos apagado/físico/parcial, contenido obsoleto, entrega sin preparación, errores de lectura y autenticación existente.
- Tipos de aplicación comparados con la base, tipos Node, lint focalizado, build y comprobación Deno. Los arneses locales no acreditan sesiones autenticadas ni operaciones productivas.

Pruebas principales: `stockBagAccountingTest.mjs`, `stockBagAccountingBoundariesTest.mjs`, `stockBagAccountingClientTest.mjs`, `stockBagAccountingBrowserTest.mjs`, `stockBagAccountingNativeTest.mjs`, `stockBagRouteBrowserTest.mjs` y `laundryLaunchRouteWorkflowTest.mjs`, bajo `scripts/`.
