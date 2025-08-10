# Hoja de Ruta: Sistema de Logística

Objetivo
- Diseñar y desplegar un módulo de Logística para preparar y distribuir cajas con materiales de limpieza (textiles, amenities, consumibles) a propiedades, integrándose con Inventario y Tareas.

Beneficios Clave
- Reducción de roturas de stock en campo
- Preparación guiada y auditable de cajas
- Trazabilidad de entregas y devoluciones
- Visibilidad de demanda futura (por tareas/reservas) y consumo real

Roles y Permisos (propuestos)
- admin/manager: gestión completa, configuración y analíticas
- supervisor: visibilidad, control operativo
- logistics (nuevo rol propuesto): preparación, rutas, entregas y devoluciones
- cleaner: visibilidad de entregas asignadas a su propiedad (opcional)

Estados Principales (máquinas de estado)
- Picklist: draft → reserved → packed → handed_to_driver → completed → cancelled
- Delivery: planned → in_transit → delivered → partially_delivered → failed → returned
- Return (opcional F2+): planned → collected → received → processed

Alcance por Fases
Fase 1 (MVP operativo)
- Generación de Picklists desde tareas de limpieza próximas (día/semana)
- Reserva de stock al confirmar picklist
- Pantalla de preparación/packing con confirmación de items
- Creación de entregas por propiedades y listado de paradas
- Marcar entrega “delivered/failed”, comentarios e incidencias
- Exportaciones CSV y métricas básicas

Fase 2
- Devoluciones (recogida de ropa sucia y sobrantes)
- Etiquetas con QR y escaneo en packing/entrega
- Rutas con optimización simple (orden manual + distancia estimada)
- Notificaciones (correo/toast) a managers ante incidencias logísticas

Fase 3
- Analítica avanzada (fill rate, on-time rate, mermas, consumo por ruta)
- Integración con mapas y estimación de tiempos
- Reaprovisionamiento automático sugerido según demanda

Modelo de Datos (propuesto, nuevas tablas)
- logistics_kits (plantillas opcionales)
  - id, name, description, is_active
- logistics_kit_items
  - id, kit_id (fk), product_id (fk inventario), quantity
- logistics_picklists
  - id, code, status, scheduled_for (date), created_by, notes
  - tasks_context jsonb (resumen tareas origen)
- logistics_picklist_items
  - id, picklist_id, product_id, required_qty, reserved_qty, packed_qty
  - property_id nullable (cuando item esté asociado a una propiedad concreta)
- logistics_deliveries
  - id, picklist_id, code, status, driver_id (user/cleaner opcional), vehicle text
  - planned_date, started_at, completed_at, notes
- logistics_delivery_stops
  - id, delivery_id, property_id, status, planned_order, delivered_at, notes
- logistics_delivery_items
  - id, delivery_id, stop_id, product_id, quantity, delivered_qty, notes
- logistics_returns (F2)
  - id, delivery_id?, property_id, status, collected_at, notes
- logistics_return_items (F2)
  - id, return_id, product_id, quantity, condition text

Relaciones con inventario (tablas existentes)
- inventory_products, inventory_stock, inventory_movements
- property_consumption_config y property_amenity_inventory_mapping (para estimar demanda)

Reglas RLS (lineamientos)
- Admin/manager: ALL
- Supervisor: SELECT + algunas UPDATE operativas
- Nuevo rol logistics: SELECT/INSERT/UPDATE en picklists, deliveries y returns
- Ningún rol externo puede modificar inventario directamente; movimientos via funciones/servicios controlados

Funciones/Triggers (Supabase, propuestas)
- RPC create_picklist_from_tasks(date_range json / día):
  - Lee tasks (pending/confirmed) → agrega productos requeridos por property_consumption_config
  - Genera logistics_picklist + items con required_qty
- RPC reserve_stock_for_picklist(picklist_id, user_id):
  - Valida disponibilidad y “reserva” (no descuenta stock todavía), guarda reserved_qty
- RPC commit_packing(picklist_id, user_id):
  - Genera movimientos ‘salida’ por packed_qty y actualiza inventory_stock
  - Cambia picklist a packed
- RPC create_delivery_from_picklist(picklist_id, driver_id?, planned_date)
- RPC complete_delivery_stop(stop_id, delivered_items json)
  - Actualiza delivered_qty y estado del stop
- Triggers de updated_at y consistencia de estados

Flujos Operativos
1) Demanda → Picklist
- Manager elige rango (p.ej., mañana)
- Sistema calcula productos por tareas/properties y crea picklist (draft)
- Operario verifica/edita cantidades y confirma reserva (reserved)

2) Preparación/Packing
- Vista de packing lista por producto o por propiedad
- Confirma packed_qty (teclado/escáner QR F2)
- Commit packing: descuenta stock y etiqueta cajas

3) Rutas y Entregas
- Crear Delivery desde un Picklist
- Definir paradas (una por propiedad), ordenarlas
- Con móvil: marcar in_transit → delivered/failed por parada
- Captura de observaciones e incidencias

4) Devoluciones (Fase 2)
- Crear orden de devolución por propiedades
- Registrar items recogidos (ropa sucia, sobrantes)

Interfaz de Usuario (páginas nuevas)
- Logística Dashboard
  - KPIs: picklists del día, entregas en curso, incidencias, fill rate
- Picklists
  - Listado, crear desde tareas, detalle con items, botón “Reservar” y “Empaquetar”
- Packing View
  - Modo por producto y por propiedad, confirmación rápida, soporte escáner
- Entregas
  - Planificación de ruta, paradas, estado por parada, marcar entregado/failed
- Devoluciones (F2)
  - Crear, recoger, registrar cantidades
- Analítica (F3)
  - On-time rate, fill rate, mermas, consumo por ruta y por propiedad

Componentes/Hooks (frontend, mínimos)
- hooks/useLogisticsPicklists
- hooks/useLogisticsDeliveries
- components/logistics/PicklistList, PicklistDetail, PackingView
- components/logistics/DeliveryList, DeliveryDetail, DeliveryStopCard
- components/logistics/LogisticsDashboardCards

Integraciones Clave
- Inventario: reserva/consumo → movimientos y stock
- Tareas: origen de demanda (día/semana)
- Propiedades: destinos de entrega
- Notificaciones (sonner/toast) en eventos críticos (falta stock, delivery failed)

KPIs (MVP y evolución)
- Fill rate (% items entregados vs requeridos)
- Entregas a tiempo (% paradas “on time”)
- Incidencias (por ruta, propiedad, producto)
- Roturas de stock evitadas (estimado) y reales
- Tiempo de preparación por picklist

Plan de Implementación (estimado)
Semana 1
- Esquema Supabase (tablas picklists, deliveries, stops, items)
- RPC create_picklist_from_tasks y reserve_stock_for_picklist
- UI básica: listado y detalle de picklists

Semana 2
- Packing View + commit_packing (movimientos de inventario)
- Crear delivery desde picklist + stops
- UI entregas: listado/Detalle, actualizar estados

Semana 3
- Métricas MVP + exportaciones CSV
- Manejo de incidencias en entrega
- Pruebas con datos reales y ajustes RLS

Semana 4 (F2)
- Devoluciones + QR/escaneo básico
- Notificaciones y mejoras UX móvil

Riesgos y Mitigaciones
- Falta de stock al empacar: mostrar alternativas, replanificar, alertas tempranas
- Datos incompletos de tareas: fallback a consumo estándar por propiedad
- RLS demasiado restrictivo: pruebas con cada rol y políticas granulares
- Complejidad en rutas: empezar manual y evolucionar

Checklist de Lanzamiento (MVP)
- [ ] Tablas y RLS creadas, sin advertencias del linter
- [ ] RPCs probadas con datos de prueba
- [ ] UI picklists/packing/deliveries funcionales en móvil
- [ ] Movimientos de inventario correctos en packing
- [ ] Exportaciones CSV verificadas
- [ ] Métricas básicas visibles

Anexos: Enumerados (propuestos)
- picklist_status: draft, reserved, packed, handed_to_driver, completed, cancelled
- delivery_status: planned, in_transit, delivered, partially_delivered, failed, returned
- stop_status: planned, in_transit, delivered, failed

Notas de Diseño
- Mantener componentes pequeños y reutilizables
- Colores/temas desde design system (sin hardcodear)
- Preparar vistas responsive y offline-friendly para repartidores (lectura/acciones mínimas)

Próximos Pasos
1) Validar el alcance de Fase 1
2) Crear migración de tablas y RLS (incluye nuevo rol logistics si se aprueba)
3) Implementar UI mínima de picklists → packing → deliveries
4) Pilotaje con 1-2 rutas reales y ajustes
