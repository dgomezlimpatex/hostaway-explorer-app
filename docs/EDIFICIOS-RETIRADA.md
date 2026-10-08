# Retirada de edificios conservando el historial

Estado: preparado para revisión; migración pendiente de autorización específica.

El botón «Eliminar edificio» del editor lateral retira el edificio aunque tenga
personal o propiedades. La confirmación explica que se conservará el historial.
Los cambios pendientes deben guardarse o descartarse antes de retirar.

## Operación

`retire_property_group(uuid)` realiza en una única transacción:

- Bloquear el edificio y comprobar los permisos actuales de administración/gestión.
- Guardar fecha, autor y copia del edificio y de los vínculos retirados (incluidos
  vínculos inactivos y exclusiones) en `retirement_snapshot`.
- Quitar los vínculos de `property_group_assignments` y `cleaner_group_assignments`.
- Marcar el edificio inactivo y desactivar su asignación automática.

No elimina el edificio, las personas, las propiedades, tareas, revisiones,
incidencias, trabajo de supervisión ni almacenes. Tampoco modifica existencias,
accesos de supervisoras o tareas ya asignadas. El historial permanece en sus tablas
y el edificio conserva su identificador. No se añade una pantalla de recuperación.

La función respeta RLS (`SECURITY INVOKER`) y solo puede ejecutarse como usuario
autenticado administrador/gestor. Dos retiradas del mismo edificio se serializan y
un reintento conserva la primera copia. Los triggers impiden nuevas vinculaciones
o modificaciones de vínculos hacia un edificio retirado, y protegen el edificio
retirado de cambios/borrado. Un fallo revierte toda la transacción. Los bloqueos
pueden causar el rechazo seguro de una operación concurrente, que debe recargarse.

La interfaz no reintenta una escritura con respuesta incierta: pide recargar y
cierra el editor si la retirada se confirma. La lista operativa existente ya filtra
por `is_active = true`. La acción avanzada de borrado físico de edificios vacíos en
la ficha antigua no se amplía en esta entrega; un edificio retirado queda protegido
también frente a esa acción.

## Activación revisada

Aplicar únicamente `supabase/migrations/20261008120000_retire_property_group.sql`,
con autorización expresa y reserva de la cola activa. No ejecutar el historial de
migraciones completo. Esta migración añade dos columnas, tres funciones y tres
triggers; no retira ningún edificio existente ni modifica políticas RLS.

Preflight de solo lectura comprobado: ambas columnas y la RPC no existen; las
tres tablas permiten escrituras a administradores/gestores. Las tablas de vínculos
no tienen referencias entrantes. El borrado físico de edificios sí tendría efectos
en cascada sobre supervisión, de ahí la retirada sin DELETE del edificio.

Después de aplicar: comprobar columnas, funciones, permisos y triggers; publicar
el frontend por la cola revisada y verificar ambos dominios. No utilizar un edificio
real como prueba de borrado/retirada. Revertir solo el frontend conserva los archivos
históricos; no eliminar las columnas con copias guardadas como reversión automática.

## Pruebas locales sin producción

- `node scripts/retirePropertyGroupTest.mjs`: PostgreSQL en memoria (PGlite),
  permisos, fallo/rollback, idempotencia, preservación de historial y entidades,
  vínculos obsoletos rechazados y reutilización de personas/propiedades.
- `node scripts/retirePropertyGroupStorageTest.mjs`: llamada única a la RPC,
  propagación de errores y lectura de la fecha de retirada.
- `node scripts/buildingSideEditorBrowserTest.mjs`: navegador con backend simulado,
  cancelación, retirada de edificio ocupado y vacío, respuesta perdida y recarga,
  guardado/descarte, conflictos y vista móvil.
- `node scripts/buildingSideEditorTest.mjs`: regresión de edición en borrador.

Los ensayos PGlite no reproducen dos conexiones simultáneas ni Supabase Auth real;
los bloqueos se revisan en SQL y los permisos se ensayan con roles y RLS locales.
