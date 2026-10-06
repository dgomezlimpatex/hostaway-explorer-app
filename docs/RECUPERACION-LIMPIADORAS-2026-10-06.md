# Recuperación de las mejoras de limpiadoras

## Procedencia y base actual

Se han recuperado las mejoras sin publicar de la copia «APP GESTION LIMPATEX - Optimizacion 2026-09-29». Los archivos modificados se han combinado usando como referencia su versión del índice de Git, para separar la optimización de los cambios de producción que ya contenía esa copia.

La adaptación parte de `origin/main` en `4828539e9de00765c4bfaf043c755a408c64d13d`. El 6 de octubre se verificó que ambos dominios canónicos servían `dpl_97Sm9CAzEo9qjz7PoAz3BQczVc5d`, READY, con ese mismo commit en sus metadatos. La huella de fuente del commit base coincide con la registrada por producción: `3a6f88f583b49d1faab5babf7d262fa8e1b6541f309d6901923ee375c8e945b3`. Se conservan la corrección reciente de acceso `passwordSignIn`, el layout actual de gestión, los controles del planificador y las demás pantallas actuales.

Las copias originales permanecen intactas. El paquete no importa la planificación, la cola de correos ni las migraciones pendientes de la copia antigua.

## Mejoras recuperadas

- Carga separada de las pantallas de limpiadora y gestión; consultas de las tareas propias y descarga anticipada de fichas y checklists de la semana.
- Acceso directo desde tareas y calendario al inicio, checklist, fotografías, notas, revisión y finalización.
- Guardado de avances y archivos en IndexedDB del móvil. La confirmación de guardado espera a que termine la escritura local.
- Apertura de pantallas descargadas sin cobertura mediante un service worker que conserva recursos estáticos; excluye respuestas de Supabase y enlaces públicos de lavandería.
- Envío al recuperar cobertura con la app abierta, identificación estable de fotos, reintentos sin duplicados y confirmación de la revisión realmente enviada.
- Conservación de ediciones realizadas durante el envío. Los conflictos, cambios de checklist y reasignaciones dejan el avance pendiente y visible.
- Recuperación de trabajo pendiente que ya no aparece en la semana actual; lectura de sus fotos y notas.
- Fotos procesadas de una en una, compresión y botones móviles accesibles; mensajes que distinguen guardado local y envío confirmado.
- Recuperación de la interfaz de limpieza desde la sesión y datos previamente guardados de esa cuenta, incluso si su renovación espera conexión. El servidor mantiene la autorización de las escrituras.

Durante la adaptación se reforzó la comprobación del propietario de cada foto y se filtraron los borradores por cuenta antes de mostrarlos. Se conservó la protección actual que solo cuenta contraseñas incorrectas como fallos de credenciales.

## Comprobaciones realizadas

- `npm run build`: correcto; entrada de la aplicación aproximadamente 379 KB, 110 KB gzip.
- TypeScript real de aplicación: 102 diagnósticos antes y después; comparación de archivos, códigos y mensajes, sin diagnósticos nuevos.
- TypeScript de Node/configuración: correcto.
- Lint de archivos nuevos: correcto. En los archivos modificados, 13 errores heredados antes y 9 después; ninguno nuevo.
- Regresiones existentes: `taskReportCompletionTest`, `subtaskPhotoGalleryTest`, `roleModeTest` y `passwordSignInTest`, correctas.
- `node scripts/cleanerOfflineBrowserTest.mjs`: correcto con la aplicación compilada, Chromium móvil/escritorio, IndexedDB y service worker reales. Todos los accesos de backend están interceptados y usan cuentas y datos sintéticos.
- Casos de navegador: descargar sin iniciar una tarea; iniciar, exigir foto, añadir foto y notas, finalizar sin cobertura, recargar y recuperar; fallos de envío, respuesta perdida de una subida, ausencia de duplicados, ediciones concurrentes, rechazo de actualización concurrente, reasignación canónica, aislamiento de cuenta, bloqueo entre pestañas, limpieza solo de trabajo confirmado, conflictos de notas, login y enlace directo del calendario. También reapertura offline con sesión persistida caducada.
- Revisión visual móvil y escritorio y comprobación adicional del formulario local con agent-browser.

No se han utilizado cuentas reales ni ejecutado SQL, migraciones, cambios de RLS, despliegues de funciones, envíos de comunicaciones ni escrituras en Supabase de producción.

## Uso y publicación

El primer acceso y la descarga inicial necesitan cobertura. El envío pendiente continúa con la app abierta y con conexión; no se promete subir fotografías con el navegador cerrado. El trabajo local pertenece a ese dispositivo y puede perderse si se borran sus datos del navegador. Las comprobaciones se han hecho en Chromium con datos locales; no equivalen a una prueba en un iPhone/Android físico ni a una escritura operativa contra las políticas actuales de producción.

El paquete está preparado para revisión específica. Contiene cambios de autenticación/sesión, escritura de reportes y fotografías al reconectar y configuración del guardado offline. Estos efectos están reservados por AGENTS.md y no se presentarán como una mejora visual ni como una entrega automática sin efectos reservados. La publicación queda pendiente de autorización específica y debe usar la reserva de la cola común descrita en `docs/ENTREGA-AUTOMATICA.md`.
