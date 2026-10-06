# Portal de clientes: diseño y calendario — 6 de octubre de 2026

Diseño integrado a partir de la prueba aprobada por Dani: marca morada, cabecera compacta, acción para añadir tareas, lista por alojamiento y Operativa con tarjetas claras. El formulario conserva la creación múltiple de reservas y su limpieza asociada; la edición, cancelación, reportes e incidencias conservan sus servicios existentes.

El calendario presenta las noches de estancia desde la entrada inclusive hasta la salida exclusive. La limpieza se muestra por su fecha real, independientemente de la salida. No se inventan estancias para tareas sin fechas. Las cancelaciones no ocupan noches. En móvil se inicia en la agenda por día; se conservan semana y mes. Las propiedades asignadas pueden aparecer aunque no tengan reservas en el periodo. La etiqueta sin estancia registrada no acredita disponibilidad comercial.

Operativa conserva el filtro por día, estados normalizados, orden por hora prevista, actualización periódica y reportes. Solo aparece cuando la configuración existente la habilita. No se modifica acceso, autenticación ni permisos. Se conserva el enlace administrativo de regreso al listado.

## Verificación

- `node scripts/clientPortalDesignTest.mjs`: componentes reales con hooks e interfaz simulados en memoria, sin red. Ocupación, salida, rotación, estancias que cruzan semanas, fechas inválidas, DST Madrid, vistas del calendario, detalle, búsqueda, edición, creación y visibilidad de controles.
- Pruebas existentes: `clientPortalOperationalTest.mjs`, `clientPortalNoCompletionTimeTest.mjs` y `clientPortalVisibilityTest.mjs`.
- Build y tipos Node correctos. Tipos reales de aplicación: mismos 102 errores históricos que la base, sin nuevos. Lint focalizado sin errores nuevos; se conservan dos `any` históricos del manejo táctil de la galería.
- Navegador: componentes reales con datos locales y hooks simulados, calendario semanal, agenda de 390 px y Operativa en escritorio y móvil; sin desbordamiento horizontal en móvil. Las comprobaciones funcionales se realizan con el arnés local, sin sesión productiva ni escrituras reales.

No se modifican hooks de datos, Supabase, sincronizaciones, comunicaciones ni infraestructura. La entrega usa la cola protegida, que repite verificaciones y valida la fuente vigente antes de publicar.
