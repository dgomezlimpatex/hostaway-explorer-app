# Gestión de amenities por cliente y propiedad

Petición de Dani del 07/10/2026: añadir Gestión de amenities con el mismo comportamiento visual de lavandería. Incluye únicamente kits de baño, cocina y alimentación, y paño/bayeta de cocina.

## Comportamiento preparado

- El cliente define el valor por defecto; la propiedad lo hereda con `NULL` o lo personaliza con `true`/`false`.
- Desactivado: los cuatro tipos se muestran en 0 y sus campos quedan bloqueados. Las cantidades configuradas se conservan y reaparecen al activar.
- El paño de cocina aparece en Amenities aunque su categoría de inventario sea Consumibles. Papel, bolsas y lencería conservan su comportamiento independiente.
- Alternar es un borrador. Guardar persiste el ajuste mediante las mutaciones existentes; cancelar recupera el formulario original.
- La duplicación de propiedad conserva el ajuste de amenities.

## Persistencia pendiente de autorización

La inspección de solo lectura del esquema productivo confirmó que no existe un indicador independiente de amenities en clients/properties. No se reutiliza `planning_requires_amenities_load`, porque es una regla de planificación distinta.

Propuesta exacta: `scripts/propertyAmenitiesSettings.sql`. Añade `clients.amenities_control_enabled boolean NOT NULL DEFAULT true` y `properties.amenities_control_enabled boolean DEFAULT NULL`. Los defaults conservan el comportamiento previo de los clientes y la herencia de propiedades. No cambia cantidades, stock, tareas, permisos, políticas, funciones ni cron. Este ajuste controla la visualización/edición solicitada; no modifica los cargos automáticos del inventario.

No se ha aplicado el SQL ni publicado esta mejora. La entrega debe usar la reserva y publicación revisada de `docs/ENTREGA-AUTOMATICA.md` después de autorización específica, nunca la etiqueta de entrega automática funcional con efectos declarados falsos.

## Verificación local

- `node scripts/propertyAmenitiesSettingsTest.mjs`: mappers, esquema de formularios, duplicación, clasificación precisa y SQL exacto en PostgreSQL WASM aislado. Comprueba defaults, valores explícitos, conservación de cantidades, RLS y políticas.
- `node scripts/propertyAmenitiesDisplayTest.mjs`: componentes reales en navegador con fixtures, cuatro productos, herencia, overrides, lavandería/papel independientes, guardar/cancelar, recálculo, carga/error, control de cliente, escritorio/móvil sin desbordamiento. Sin cliente Supabase ni red.
- Regresión de lavandería y contrato de propiedades: correctos.
- Build, tipos raíz y Node: correctos. Tipos reales de app: exactamente los mismos 102 diagnósticos previos. Lint: conserva los tres errores previos de `any` en clientMappers; ningún error nuevo en el resto.
- No se ha probado una sesión real ni escrituras productivas.
