# Requiere tu atención — implementación local

Rama: `codex/dashboard-attention-20261005`, sobre el semáforo publicado y las mejoras de acceso/replanificación conservadas en `9fb0e67`. No se ha aplicado SQL ni publicado este bloque.

## Comportamiento

Bloque compartido en los dashboards de coordinación de escritorio/móvil, bajo el resumen. Solo tareas reales asignadas de hoy en la sede activa, según Europe/Madrid. Cinco tareas inicialmente, lista completa, filtros con recuentos de tareas y detalle por trabajadora. Las incidencias existentes permanecen separadas.

Prioridad: sin finalizar (reporte abierto 60 min después del fin individual previsto), sin reporte iniciado (fin +15 min), inicio pendiente (inicio +15 min), duración a revisar (reporte cerrado y diferencia de al menos 15 min Y 25%, positiva o negativa). El aviso de falta de reporte reemplaza al de inicio para una misma persona. No se calculan duraciones cortas mientras se trabaja.

Reutiliza el tiempo individual de las tareas compartidas. El estado global de la tarea no oculta un reporte abierto de otra compañera. Sin tiempos válidos, duraciones previstas o asignaciones/reportes identificables, se muestran datos por comprobar en lugar de inventar una duración. El tiempo registrado no descuenta pausas.

Actualiza cada minuto visible, al volver a la pantalla y al cambiar la caché de tareas/reportes. Las consultas acotan sede y día; reportes y claves revisadas se paginan. Ante errores no presenta datos antiguos como un resultado fiable ni afirma que no hay avisos.

## Revisiones

Se guarda una revisión por ocurrencia y persona. La clave contiene tarea, asignación, tipo/dirección, planificación y tiempos/estado del reporte; no incluye el reloj actual, nombres ni modificaciones de checklist. Revisar no modifica tareas/reportes. El mismo aviso permanece revisado al crecer el retraso; cambios relevantes o motivos nuevos permiten reaparecer.

Historial de revisiones con día de tarea y tipo, 30 días por defecto y paginación de 100 filas. Copia la información mostrada, autor y fecha. La sede y el autor se controlan en servidor; la copia sobrevive a la eliminación de la tarea. Solo administradores/managers con acceso a sede. No permite editar ni borrar revisiones desde el cliente.

## SQL preparado, sin aplicar

`supabase/manual/20261005_operational_alert_reviews.sql` crea únicamente la tabla de revisiones, su índice, políticas/grants y el trigger de validación/autoría. No instala cron ni modifica tareas, reportes o notificaciones. Una restricción única resuelve revisiones simultáneas; la segunda petición idéntica se trata como éxito. La FK de tarea usa ON DELETE SET NULL.

Antes de aplicar: comprobar en lectura el esquema vigente de tasks (incluidos date/sede_id/cleaner_id), task_assignments, profiles y sedes, las firmas/semántica de has_role y user_has_sede_access y la ausencia de una tabla equivalente. Revisar el SQL aislado y pedir autorización específica para aplicarlo. No ejecutar el historial de migraciones ni db push. Comprobar grants, RLS y acceso por sede tras su aplicación. La app muestra una explicación de activación pendiente si la tabla aún no existe.

Después, con autorización de publicación: identificar la fuente activa de Vercel, conservar cambios posteriores, integrar solo esta función, compilar y verificar ambos dominios. Este trabajo no autoriza esos pasos externos.

## Pruebas reproducibles sin producción

- `node scripts/attentionDomainTest.mjs`: márgenes exactos, duración ±, tareas compartidas, claves revisadas, sede/día, datos inválidos y Madrid/DST; no muta sus entradas.
- `node scripts/attentionReviewsPgLiteTest.mjs`: requiere PGLITE_TEST_MODULE apuntando a una instalación local de PGlite; ejecuta el SQL exacto en PostgreSQL WASM aislado. Comprueba roles, sedes, snapshot, autoría, duplicados y conservación al borrar la tarea. No admite una URL Supabase.
- `node scripts/attentionBrowserPreview.mjs`: componentes reales y almacenamiento simulado, navegador con cualquier solicitud externa bloqueada. Escritorio/móvil, filtros, agrupación/límite, detalle, revisión fallida y correcta, historial, estados vacío/error/reintento y apertura de tarea.
- Añadir `--serve` al ejemplo para mantenerlo disponible en http://127.0.0.1:8098/ y http://127.0.0.1:8098/?mobile. Todos sus datos son ficticios; las revisiones se reinician al recargar.

Build y lint focalizado pasan. Tipos de aplicación: 102 diagnósticos previos, mismos mensajes que la base (sin nuevos); tipos Node/raíz correctos. La evidencia visual está en `C:/Users/danig/.codex/project-audits/dashboard-attention-20261005/preview`. No se ha validado una sesión autenticada de producción, concurrencia PostgreSQL nativa ni el esquema remoto actual.
