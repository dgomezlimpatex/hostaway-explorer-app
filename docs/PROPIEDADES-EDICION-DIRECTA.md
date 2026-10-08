# Edición directa de propiedades — 8 de octubre de 2026

Dani solicita editar los datos de cada propiedad desde Ficha, Consumos y las demás pestañas, sin abrir «Editar propiedad», y añadir «Guardar cambios». Las instrucciones del proyecto autorizan entregar las funciones solicitadas mediante la cola protegida.

La ficha reutiliza los controles y validaciones existentes. Ficha, Consumos y las notas de Checklist comparten un borrador; cambiar de pestaña no lo reinicia. Guardar envía únicamente los campos/productos modificados a las operaciones existentes. Descartar recupera los datos guardados. Las acciones de checklist, duplicado, borrado y personal preferente conservan sus circuitos independientes y se bloquean mientras hay un borrador pendiente.

Se avisa antes de cambiar de propiedad, filtros, cerrar la ficha móvil o seguir un enlace cuando existen cambios pendientes. Al recargar/cerrar la ventana se utiliza el aviso nativo del navegador. El botón Atrás del navegador, cambios externos de sede y cambios de tamaño que desmonten la ficha no están cubiertos por un bloqueo de navegación global.

## Revisión de efectos y ruta de entrega

La nueva entrada de guardado escribe los datos que el usuario edite expresamente mediante useUpdateProperty y useSavePropertyStockConsumptionRules, con los controles de datos existentes. Se entrega por la ruta revisada con reserva, sin declarar productionData=false en una revisión automática. La petición autoriza este comportamiento del producto; no se han realizado escrituras de prueba sobre propiedades reales.

No hay SQL, migraciones, cambios de permisos, autenticación, servicios de almacenamiento ni Edge Functions. Tampoco se ejecutan sincronizaciones o comunicaciones. Los campos existentes de exportación/estado conservan sus efectos actuales al guardarlos expresamente; no cambian automáticamente al abrir la página.

El guardado de consumos y ficha sigue utilizando dos operaciones, sin transacción nueva. Si los consumos se guardan y la ficha falla, se informa explícitamente y se conserva el borrador para reintentar; no se anuncia un éxito total. No se ofrece garantía nueva de edición concurrente sobre el mismo campo. Los campos no editados no se envían y las notas/almacén de las reglas de consumo se conservan.

## Verificaciones

- Build de producción correcto.
- TypeScript de aplicación: 102 diagnósticos previos y 102 después, sin diagnósticos nuevos (comparación de código/mensaje/archivo contra la base mediante un host virtual de TypeScript).
- TypeScript Node y comprobación raíz correctos; lint focalizado correcto.
- scripts/propertyInlineEditBrowserTest.mjs: componentes reales con adaptadores ficticios, red bloqueada, escritorio 1440px y móvil 390px. Prueba carga fallida y reintento, edición entre pestañas, refresco sin pérdida del borrador, descarte, actualización solo de los campos modificados, notas de reglas conservadas, validación, fallo total/parcial y reintento, lavandería desactivada sin borrar cantidades, aviso al cambiar de propiedad y al cerrar móvil.
- scripts/propertiesUiContractTest.mjs: 12 comprobaciones correctas.
- scripts/propertyLaundryDisplayTest.mjs y scripts/propertyAmenitiesDisplayTest.mjs: regresiones correctas con datos locales.
- Capturas locales de escritorio y móvil revisadas. No se ha iniciado sesión ni guardado datos en producción como prueba.

Base verificada: 04e4438a83345a3160200d09718fbd6808314440. Ambos dominios canónicos servían dpl_9j24XLhD9K69NJWvfm5b6r9usbfs con ese commit antes de la entrega. La reserva debe volver a verificar producción y la base antes de integrar.


## Guardado en segundo plano — 8 de octubre de 2026

Dani solicita poder cambiar de propiedad inmediatamente después de pulsar Guardar cambios. La sesión del formulario vive ahora por separado de la ficha visible: se conserva mientras guarda y, si falla, mientras quedan cambios pendientes. Al terminar un guardado oculto no se cambia la propiedad seleccionada ni se modifican los borradores de otras propiedades. Una sesión oculta correcta se libera al finalizar.

El directorio muestra la propiedad que se está guardando y permite volver a ella. Si falla, muestra el aviso con acceso al borrador conservado para reintentar. En móvil se puede cerrar la ficha mientras guarda y abrir otra. Los campos de una misma propiedad siguen bloqueados mientras su propio guardado está en curso, evitando escrituras simultáneas sobre ella. Cambiar filtros o seleccionar otra propiedad no cancela guardados. Salir de la página o recargar sigue protegido mientras quedan operaciones pendientes; no se añade persistencia offline ni guardado tras cerrar el navegador.

Se mantienen las operaciones de datos existentes sin modificaciones. La prueba de navegador controla respuestas pendientes de dos propiedades independientes, verifica navegación inmediata en escritorio/móvil, ausencia de cambios prematuros en los datos, finalización sin saltos de selección, fallo en segundo plano, recuperación del borrador y reintento sin duplicar el guardado de la otra propiedad.
