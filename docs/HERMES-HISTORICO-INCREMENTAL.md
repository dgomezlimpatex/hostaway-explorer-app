# Histórico incremental y reportes individuales

Ampliación autorizada por Dani el 18/10/2026: pendientes y reportes por trabajador, actualización diaria incremental y comprobación semanal, sin modificar tareas.

## Datos y límites

Una carga inicial minimizada desde 01/06/2026 conserva tareas y datos estructurados de reportes, cifrados con Windows. El histórico completado llega hasta ayer; las asignaciones abarcan hoy y 14 días futuros. Las pendientes forman parte de hábitos de asignación, nunca de ejecución confirmada.

El recurso separado `limpatex_assistant_history` admite únicamente manifest y rows, con identidad individual revocable. Solo consultor y Operaciones pueden leerlo. Rentabilidad accede únicamente al resumen local agregado y Comercial no obtiene acceso. Las vistas son privadas y security_invoker; el propietario de la función mantiene NOLOGIN, NOBYPASSRLS y solo SELECT. No añade triggers ni escrituras de negocio.

Las respuestas no contienen notas libres, textos del checklist, URLs, imágenes, direcciones adicionales ni datos de contacto. Las evidencias se reducen a su presencia en metadatos del reporte: no se descargan ni inspeccionan imágenes. Se evalúa documentación registrada, no calidad de la limpieza ni identidad de quien pulsó enviar.

Estados: completo, finalizado_incompleto, iniciado_sin_finalizar, sin_iniciar, sin_reporte_registrado, no_evaluable y no_exigible_aun. Hoy/futuro quedan fuera del denominador. La autoría corresponde a cleaner_id registrado; nunca se acredita a todos los asignados por un reporte ajeno. Duplicados y autor desconocido se señalan. Una plantilla posterior al inicio del reporte no se aplica retroactivamente como incumplimiento. Sin plantilla/requisitos verificables, tiempos válidos o confirmación individual de adicionales, el caso es no evaluable. Se separa cumplir requisitos obligatorios del 100 % del checklist. Sin reporte en servidor no prueba que no exista trabajo offline.

Cada ficha tiene contadores desde junio y dos períodos comparables de 30 días, con cifras y casos excluidos. No genera puntuación de calidad o decisiones laborales ni asignaciones automáticas. El dato histórico es revisable y debe contrastarse con disponibilidad y reglas actuales.

## Sincronización

La revisión existente ejecuta refresh una vez al día después de las 06:00 Madrid. Consulta versiones de tareas nuevas/modificadas (incluye cambios en reportes, plantillas, evidencias y asignaciones) desde el watermark del servidor con un día de solapamiento. Repasa además fechas de servicio desde hace siete días hasta hoy+14. Descarga solo los paquetes cuya versión cambió. Los catálogos pequeños se releen, sin enviarlos completos a un modelo.

Cada siete días desde la última comprobación correcta —o al recuperar el equipo después de esa fecha— obtiene un manifiesto de identificadores/versiones de todo el ámbito. Detecta eliminaciones y cambios no reflejados en updated_at, pero vuelve a descargar únicamente diferencias. Es una lectura acotada: no crea eventos ni triggers de seguimiento en producción. Una eliminación antigua puede permanecer en la captura hasta esta comprobación semanal.

Versiones antes/después deben coincidir y cada paquete debe corresponder a la versión esperada. No se afirma snapshot transaccional entre llamadas. Ante error, conserva la captura anterior. Snapshot y checkpoint se reemplazan juntos en un solo archivo cifrado. La fecha de intento se guarda para impedir reintentos automáticos repetidos en el mismo día; una recuperación manual requiere revisar el fallo y usar Force expresamente.

`run.ps1 -Action refresh` realiza el trabajo normal. `-Action refresh -Force -CheckWeekly` es una comprobación manual completa de versiones; no se utiliza en la programación diaria. `-Action record` publica una sola nota por fecha/huella en Obsidian. Repetir con la misma clave y contenido no duplica. Los revisores existentes continúan Astra/high; reciben el resumen y pueden consultar detalle paginado, con propuestas/avisos por el publicador existente.

## Validación

Pruebas Python del cálculo, incremental, cambios de asignación/reporte, cursores, correcciones, borrados, fallos, clasificación y perfiles. PGlite ejecuta las migraciones reales con fixtures sin datos reales, verifica permisos SELECT, ausencia de campos privados, deniega DML, perfiles no autorizados y acciones arbitrarias. Las pruebas reales usan únicamente lecturas y memoria local. Nunca se insertan, modifican ni borran tareas/reportes para probar el circuito.
