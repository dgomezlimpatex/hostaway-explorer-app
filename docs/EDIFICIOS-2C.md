# Edificios: listado y editor lateral (8 de octubre de 2026)

Petición: Dani seleccionó la propuesta visual 2C y pidió implementarla. El listado muestra nombres y roles del equipo habitual y códigos de propiedades, con búsqueda por edificio, persona o propiedad y filtros por zona, ausencia de titular o propiedades. Un panel lateral permite editar sin abandonar el conjunto; en móvil se presenta sobre el listado y conserva el borrador al cambiar el tamaño de pantalla.

Los cambios de rol, altas/bajas de vínculos de personal, propiedades y nombre de supervisión de referencia quedan en memoria hasta Guardar cambios. Descartar recupera la base. La ficha completa conserva ajustes avanzados y asignación de supervisoras con acceso. El campo de referencia no concede permisos. La creación y eliminación de edificios vacíos conservan el servicio y sus validaciones existentes.

## Revisión de efectos

- Reutiliza exclusivamente propertyGroupStorage y las lecturas existentes. No cambia SQL, esquema, RLS, autenticación, permisos, sincronización, notificaciones, infraestructura ni costes.
- No hay escrituras al abrir, buscar, seleccionar o descartar. Al guardar explícitamente, el usuario modifica relaciones persistentes existentes. Por ello se entrega por la ruta de publicación revisada; no se declara productionData=false para entrar en la ruta automática.
- No se realizaron escrituras operativas en producción para desarrollar ni comprobar el cambio.
- El rol conserva límites, notas y conocimiento de los vínculos existentes. Cambiar rol usa las prioridades predeterminadas del editor actual; No apta mantiene su regla de activación. Los vínculos inactivos y excluidos se cargan en el editor y evitan altas duplicadas.
- Antes de guardar se relee el edificio, todos sus vínculos de personal y las propiedades. Una diferencia con la base o una propiedad vinculada a otro edificio bloquea el guardado.
- Los servicios actuales realizan varias operaciones; no existe una transacción conjunta. Ante cualquier error se detiene el resto, no se reintenta ni revierte automáticamente y se exige recargar el estado guardado. Esa recarga descarta la intención pendiente y muestra los resultados confirmados. No se promete exclusión de carreras entre la comprobación previa y las escrituras; lograrla requeriría un cambio de backend aparte.

## Verificación

- scripts/buildingSideEditorTest.mjs: código real del borrador y guardado con servicios simulados. No-op, aislamiento del borrador, conservación de campos avanzados, altas, desvinculación, conflicto, propiedad ocupada y fallo parcial.
- scripts/buildingSideEditorBrowserTest.mjs: página real compilada con adaptadores de datos locales, sin cliente productivo ni tráfico externo. Búsqueda por persona/propiedad, edición, descarte, protección al cambiar edificio, guardar, bloqueo durante guardado, altas sin duplicar vínculos inactivos, propiedad ocupada, fallo parcial, conflicto, escritorio/móvil, conservación al redimensionar, creación, eliminación vacía y error de catálogo.
- Build y tipos Node correctos; lint focalizado sin errores. Tipos de aplicación: 102 errores previos y 102 finales, sin diagnósticos nuevos (comparación contra copia aislada de la base).
- planningBuildingCrmServiceTest.mjs pasa. planningBuildingCrmUiContractTest.mjs contiene expectativas obsoletas del listado y falla ya en la base; no se modifican ni se presenta esa batería como aprobada.

La revisión de publicación debe ligarse al commit exacto y comprobar CI, reserva y ambos dominios. Las pruebas locales no acreditan una sesión autenticada ni una escritura real en producción.
