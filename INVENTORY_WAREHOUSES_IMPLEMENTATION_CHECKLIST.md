# Checklist: Stock Profesional por Almacenes

Objetivo: construir un sistema nuevo y profesional de control de stock para Lavanderia y Amenities, con almacenes, stock por almacen, consumo automatico por tarea, movimientos, alertas, reportes y transferencias.

El modulo de inventario existente se considera legacy. No se debe tomar como arquitectura objetivo. Se puede consultar solo para entender integraciones actuales, evitar romper rutas en produccion y decidir si algun dato merece migrarse.

## Estado Global

- [x] Fase 0: Preparacion segura
- [x] Fase 1: Base de datos y migracion compatible con produccion
- [x] Fase 2: UI basica de almacenes y stock por almacen
- [x] Fase 3: Vistas separadas Lavanderia y Amenities
- [x] Fase 4: Consumo automatico por tarea
- [x] Fase 5: Transferencias entre almacenes
- [ ] Fase 6: QA, PR, deploy y cierre

## Decisiones Tomadas

- Inventario actual: legacy. No se usara como base arquitectonica del nuevo modulo.
- Datos legacy: no se migran por defecto. El nuevo inventario empezara con catalogo/stock limpio salvo que se identifique algun dato valioso puntual.
- Estrategia de UI: reemplazo progresivo de las rutas actuales de inventario con pantallas nuevas, manteniendo compatibilidad de navegacion durante la transicion.
- Tablas DB: preferencia por tablas nuevas `stock_*` para evitar arrastrar constraints, nombres y logica antigua.

## Reglas Criticas

- [x] Trabajar siempre en rama `codex/...`, nunca directamente sobre `main`.
- [x] No tocar `src/integrations/supabase/types.ts` a mano.
- [x] Toda tabla nueva en `public` debe incluir `GRANT` explicitos, RLS y policies.
- [x] FKs hacia `tasks` deben usar `ON DELETE SET NULL` salvo requisito contrario.
- [ ] Todo cambio en Edge Functions requiere redeploy.
- [x] La `service_role` nunca debe aparecer en frontend, commits ni variables `VITE_*`.
- [ ] Mantener timezone Europe/Madrid y patrones existentes de `formatMadridDate`.
- [ ] Mantener duraciones en incrementos de 0.25 horas cuando aplique.
- [x] El inventario legacy no debe condicionar el nuevo diseno salvo por compatibilidad temporal.
- [x] Si se reemplaza una ruta legacy, debe hacerse con una pantalla nueva o un wrapper claro, no parcheando componentes antiguos sin criterio.

## Fase 0: Preparacion Segura

- [x] Crear rama `codex/inventory-warehouses`.
- [x] Confirmar estado base limpio o documentar cambios preexistentes.
- [x] Ejecutar `npm run build`.
- [x] Ejecutar `npx tsc --noEmit --pretty false`.
- [x] Revisar tablas actuales de inventario en migraciones.
- [x] Revisar funciones actuales de consumo automatico.
- [x] Revisar pantallas actuales de inventario.
- [x] Marcar el inventario actual como legacy y decidir estrategia:
  - reemplazo directo de rutas actuales
  - convivencia temporal con rutas `/inventory-v2`
  - migracion progresiva por pantallas
- [x] Decidir si se migran datos antiguos o se empieza con inventario limpio.
- [x] Definir convencion unica de cantidades en movimientos:
  - entradas: cantidad positiva
  - salidas/consumo: definir si se guardan positivas con tipo o negativas
- [x] Definir si lavanderia en esta fase es stock consumible simple o ciclo avanzado de mudas.
- [x] Crear plan de rollback para migracion DB.

## Fase 1: Base de Datos

- [x] Definir nombres finales de tablas nuevas.
- [x] Preferencia: tablas nuevas versionadas para no depender del schema legacy, por ejemplo:
  - `stock_warehouses`
  - `stock_categories`
  - `stock_products`
  - `stock_levels`
  - `stock_movements`
  - `stock_property_consumption_rules`
  - `stock_alerts`
- [x] Crear tabla de almacenes.
- [x] Incluir campos:
  - `id`
  - `name`
  - `sede_id`
  - `address`
  - `is_active`
  - `is_default`
  - `sort_order`
  - `created_at`
  - `updated_at`
- [x] Crear un almacen "Principal" por cada sede existente.
- [x] Garantizar un solo almacen default por sede.
- [x] Crear tabla de categorias nueva con `kind`:
  - `laundry`
  - `amenity`
  - `other`
- [x] Crear tabla de productos nueva.
- [x] Crear tabla de stock por producto y almacen.
- [x] Crear tabla de movimientos nueva con almacen origen y destino opcional.
- [x] Crear tabla de reglas de consumo por propiedad/producto.
- [x] Crear tabla de mapping de campos de propiedad a productos, si no se reutiliza el mapping legacy.
- [x] Anadir `default_stock_warehouse_id` opcional a `properties`.
- [x] Decidir si se importan productos/stock legacy o si se crean productos nuevos manualmente.
- [x] Clasificar categorias/productos iniciales sin depender de categorias legacy.
- [x] Crear indices necesarios por `sede_id`, `warehouse_id`, `product_id`.
- [x] Adaptar alertas para stock por almacen.
- [x] Crear o adaptar constraints de cantidades.
- [x] Incluir `GRANT` explicitos.
- [x] Incluir RLS y policies.
- [x] Verificar migracion con SQL revisable antes de aplicar a produccion.

## Fase 2: UI Nueva de Almacenes y Stock

- [x] Crear tipos TS propios en `src/types/stock.ts`.
- [x] Crear servicio nuevo separado del storage legacy.
- [x] Mantener funciones legacy sin tocar salvo retirada controlada.
- [x] Ampliar o reemplazar hooks de inventario con nombres claros.
- [x] Crear hooks:
  - `useStockWarehouses`
  - `useCreateStockWarehouse`
  - `useUpdateStockWarehouse`
  - `useSelectedStockWarehouse`
- [x] Crear pagina `/inventory/warehouses`.
- [x] Anadir entrada "Almacenes" al sidebar de inventario.
- [x] Crear selector de almacen:
  - Todos
  - Almacen concreto
- [x] Persistir selector en `localStorage` por sede.
- [x] Crear tabla nueva de stock por almacen o refactor controlado de `InventoryStockTable`.
- [x] Adaptar ajuste manual para elegir almacen.
- [x] Adaptar movimientos para mostrar almacen.
- [x] Mantener compatibilidad de navegacion aunque el stock legacy quede obsoleto.
- [ ] Verificar responsive movil/escritorio.

## Fase 3: Lavanderia y Amenities

- [x] Crear ruta `/inventory/laundry`.
- [x] Crear ruta `/inventory/amenities`.
- [x] Reutilizar componentes de stock con filtro `category.kind`.
- [x] Anadir entradas al sidebar:
  - Lavanderia
  - Amenities
- [x] Adaptar creacion de producto para seleccionar tipo/categoria correctamente.
- [x] Permitir crear y editar tipos/categorias de Amenities.
- [x] Permitir crear y editar tipos/categorias de Lavanderia.
- [x] Permitir editar nombres, tipos y datos principales de productos.
- [x] Sembrar o documentar categorias/productos estandar.
- [x] Confirmar que lavanderia y amenities no se mezclan en vistas filtradas.
- [x] Mantener Dashboard, Stock global, Movimientos, Configuracion y Reportes.

## Fase 4: Consumo Automatico

- [x] Revisar `process_automatic_inventory_consumption` actual.
- [x] Decidir si se reemplaza por una nueva funcion, por ejemplo `process_stock_consumption_for_task`.
- [x] Mantener la funcion legacy solo si aun hay llamadas antiguas.
- [x] Resolver almacen de consumo:
  - override por config de propiedad/producto
  - `properties.default_warehouse_id`
  - almacen default de la sede
- [x] Resolver productos por override de `stock_property_consumption_rules`.
- [x] Resolver productos por mapping global `stock_property_field_mappings`.
- [x] Evitar doble consumo si un producto aparece en override y mapping.
- [x] Actualizar crear/editar propiedades para usar productos activos de stock como consumo por limpieza.
- [x] Guardar cantidades por propiedad en `stock_property_consumption_rules`.
- [x] Mantener sincronizacion con campos antiguos compatibles para reportes/vistas heredadas.
- [x] Descontar stock por `(product_id, warehouse_id)`.
- [x] Registrar movimiento con `warehouse_id`.
- [x] Generar alertas por almacen.
- [x] Proteger contra stock negativo segun decision funcional.
- [ ] Probar con tareas reales/copias:
  - propiedad con amenities default
  - propiedad con override
  - propiedad sin almacen asignado
  - stock insuficiente
- [x] Redeploy de Edge Functions afectadas si aplica: no aplica, el cambio queda en RPC SQL y frontend.

## Fase 5: Transferencias

- [x] Anadir valor `transferencia` al enum nuevo `stock_movement_type`.
- [x] Crear funcion SQL atomica `transfer_stock_between_warehouses`.
- [x] Validar:
  - producto activo
  - almacenes distintos
  - misma sede o regla definida para transferencias entre sedes
  - cantidad positiva
  - stock suficiente si no se permiten negativos
- [x] Ajustar stock origen.
- [x] Ajustar stock destino.
- [x] Registrar movimiento con `warehouse_id` y `to_warehouse_id`.
- [x] Crear `TransferDialog`.
- [x] Anadir boton "Transferir" en stock.
- [x] Mostrar transferencias en movimientos.
- [ ] Probar transferencia completa y casos de error.

## Fase 6: QA y Produccion

- [x] Ejecutar `npm run build`.
- [x] Ejecutar `npx tsc --noEmit --pretty false`.
- [x] Ejecutar lint focalizado de los archivos nuevos/modificados de stock y propiedades.
- [x] Verificar en navegador local el modal de nueva propiedad con productos actuales.
- [x] Verificar en navegador local el modal de edicion de propiedad con valores heredados precargados.
- [x] Revisar `npm run lint` y separar errores heredados de errores nuevos.
- [x] Confirmar que el entorno local apunta a Supabase produccion.
- [x] Enlazar Supabase CLI con el proyecto `qyipyygojlfhdghnraus`.
- [x] Crear backup SQL de produccion fuera del repo.
- [x] Verificar que los ficheros de backup existen y no estan vacios.
- [x] Intentar dry-run de migraciones contra produccion.
- [x] Documentar bloqueo del dry-run CLI: el historial remoto antiguo no coincide con nombres/timestamps locales, por lo que no se repara masivamente.
- [x] Aplicar migraciones de inventario a produccion mediante Supabase MCP.
- [x] Verificar tablas, RLS, grants y RPCs en produccion.
- [ ] Probar flujo completo en local:
  - almacenes
  - stock inicial
  - ajustes
  - movimientos
  - lavanderia
  - amenities
  - consumo automatico
  - alertas
  - transferencias
- [ ] Revisar permisos por rol:
  - admin
  - manager
  - supervisor
  - cleaner
- [ ] Preparar PR a `main`.
- [x] Revisar migracion antes de merge.
- [ ] Confirmar deploy en Render.
- [x] Aplicar/revisar migracion en Supabase.
- [x] Redeploy Edge Functions afectadas: no aplica, no se cambiaron Edge Functions.
- [ ] Verificar produccion con smoke test.

## Decisiones Pendientes

- [x] Cantidades de salida en movimientos: positivas con tipo vs negativas.
- [x] Stock negativo permitido o bloqueado.
- [x] Lavanderia como stock consumible simple o ciclo avanzado de mudas.
- [x] Transferencias permitidas entre sedes o solo dentro de la misma sede.
- [x] Si el selector de almacen debe ser global por usuario, por sede o por pagina.
- [x] Reemplazo directo del inventario legacy vs convivencia temporal.
- [x] Migrar datos legacy vs empezar con catalogo nuevo.
