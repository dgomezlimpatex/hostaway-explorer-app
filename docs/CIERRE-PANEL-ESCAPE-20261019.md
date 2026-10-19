# Escape en el panel de sincronización — 19/10/2026

Petición: cerrar el panel de sincronización con Escape sin cerrar también la tarea ni afectar al trabajo sin cobertura.

## Causa y cambio

El diálogo de tarea procesa Escape en document, antes del manejador de captura React del panel anidado. Según el orden de montaje de las capas, podía iniciar también el cierre de la tarea. Detener la propagación en el panel llegaba demasiado tarde.

La cabecera comunica inmediatamente cuándo abre o cierra sincronización o notas. La tarea impide su propio cierre por Escape mientras hay uno de esos paneles abierto. El panel conserva su cierre y la devolución del foco al botón. Con ambos paneles cerrados, Escape sigue cerrando la tarea y conserva la protección durante guardados o preparación de fotos.

Solo cambia estado de interfaz. No cambia IndexedDB, fotos, datos, autenticación, envío, reintentos, sincronización ni finalización.

## Antes y después

- Antes: el flujo completo de limpiadoras fallaba al cerrar el panel sin cobertura y esperar las indicaciones de la propiedad (incidencia documentada en PROPIEDADES-PREPARACION-20261019.md). La nueva reproducción aislada también cerraba indebidamente la tarea.
- Después: pasa el flujo completo con backend interceptado y cuentas sintéticas. Pasa la prueba aislada con y sin cobertura, con y sin pendientes, abriendo repetidamente sincronización y notas; recupera el foco y mantiene el cierre normal de la tarea.
- La regresión completa compara borradores, notas, checklist, revisiones pendientes y bytes de las fotos antes y después de Escape sin cobertura: idénticos. La prueba aislada también conserva esos datos después de recargar sin conexión y comprueba cero llamadas de envío.
- El flujo completo verifica fotos obligatorias, recuperación tras cámara, errores de guardado, finalización sin cobertura, recarga, reintento de envío, ausencia de fotos duplicadas, ediciones concurrentes, reasignación y separación de cuentas.

## Verificación

Build correcto. TypeScript de raíz y Node correctos. TypeScript de aplicación: 130 errores heredados antes y después, sin diagnósticos nuevos al comparar también los mensajes de continuación y normalizar posiciones. Lint focalizado sin errores.

Pruebas: cleanerSyncEscapeBrowserTest, cleanerOfflineBrowserTest, cleanerReportPreparationTest, cleanerFinishTest, cleanerPhotoFileTest, cleanerPropertyPreparationTest y cleanerPropertyPreparationBrowserTest. Todas usan datos locales o un backend interceptado; ninguna accede a producción.

La reproducción y regresión se ejecutan en Chromium de escritorio con tamaño móvil. No sustituyen una comprobación física en todos los modelos de teléfono.
