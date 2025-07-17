# Sistema de Inventario Automatizado - Especificación Técnica

## 1. VISIÓN GENERAL
Sistema de inventario completamente automatizado que gestiona ropa de cama y amenities, con consumo automático basado en las limpiezas realizadas y los textiles predefinidos de cada propiedad.

## 2. ESTRUCTURA DE DATOS

### 2.1 Categorías de Inventario (inventory_categories)
```sql
- id (uuid, PK)
- name (text) - Ej: "Ropa de Cama", "Amenities Baño", "Amenities Cocina"
- description (text, opcional)
- is_active (boolean)
- sort_order (integer)
- created_at, updated_at
```

### 2.2 Productos de Inventario (inventory_products)
```sql
- id (uuid, PK)
- category_id (uuid, FK to inventory_categories)
- name (text) - Ej: "Sábanas", "Toallas Grandes", "Gel de ducha"
- description (text, opcional)
- unit_of_measure (text) - Por defecto "unidades"
- is_active (boolean)
- sort_order (integer)
- created_at, updated_at
```

### 2.3 Stock Actual (inventory_stock)
```sql
- id (uuid, PK)
- product_id (uuid, FK to inventory_products)
- current_quantity (integer)
- minimum_stock (integer)
- maximum_stock (integer)
- cost_per_unit (decimal, opcional)
- last_updated (timestamp)
- updated_by (uuid, FK to users)
```

### 2.4 Configuración de Consumo por Propiedad (property_consumption_config)
```sql
- id (uuid, PK)
- property_id (uuid, FK to properties)
- product_id (uuid, FK to inventory_products)
- quantity_per_cleaning (integer)
- is_active (boolean)
- created_at, updated_at
```

### 2.5 Movimientos de Inventario (inventory_movements)
```sql
- id (uuid, PK)
- product_id (uuid, FK to inventory_products)
- movement_type (enum: 'entrada', 'salida', 'ajuste', 'consumo_automatico')
- quantity (integer) - positivo para entradas, negativo para salidas
- previous_quantity (integer)
- new_quantity (integer)
- reason (text) - descripción del movimiento
- task_id (uuid, opcional, FK to tasks) - para consumos automáticos
- property_id (uuid, opcional, FK to properties) - para consumos automáticos
- created_by (uuid, FK to users)
- created_at
```

### 2.6 Alertas de Stock (inventory_alerts)
```sql
- id (uuid, PK)
- product_id (uuid, FK to inventory_products)
- alert_type (enum: 'stock_bajo', 'stock_critico')
- triggered_at (timestamp)
- resolved_at (timestamp, opcional)
- is_active (boolean)
- notified_users (jsonb) - array de user_ids notificados
```

## 3. FUNCIONALIDADES PRINCIPALES

### 3.1 Gestión de Categorías y Productos
- **Interfaz administrativa** para crear/editar categorías y productos
- **Drag & drop** para reordenar categorías y productos
- **Activación/desactivación** sin eliminación física
- **Validaciones**: nombres únicos por categoría

### 3.2 Configuración Automática de Consumo
- **Auto-configuración inicial**: usar datos existentes de properties para crear configuración automática:
  - numeroSabanas → Producto "Sábanas"
  - numeroToallasGrandes → Producto "Toallas Grandes"
  - numeroTotallasPequenas → Producto "Toallas Pequeñas"
  - numeroAlfombrines → Producto "Alfombrines de Ducha"
  - numeroFundasAlmohada → Producto "Fundas de Almohada"
  - kitAlimentario → Productos de amenities alimentarios
- **Interfaz de configuración** para ajustar qué consume cada propiedad
- **Plantillas de consumo** por tipo de propiedad

### 3.3 Consumo Automático
- **Trigger en tareas completadas**: cuando una tarea se marca como completada
- **Deducción automática** basada en property_consumption_config
- **Registro en inventory_movements** con referencia a la tarea y propiedad
- **Actualización de inventory_stock**
- **Validación de stock suficiente** antes de la deducción

### 3.4 Gestión Manual de Stock
- **Entradas de stock**: recepción de mercancía
- **Ajustes de inventario**: correcciones manuales
- **Transferencias**: movimientos internos
- **Historial completo** de todos los movimientos
- **Comentarios obligatorios** para ajustes manuales

### 3.5 Sistema de Alertas
#### Alertas por Email:
- **Stock bajo**: cuando current_quantity ≤ minimum_stock
- **Stock crítico**: cuando current_quantity ≤ 7 días de consumo promedio
- **Envío a managers y administradores**
- **Resumen diario** de alertas activas

#### Widgets en Dashboard:
- **Contador de alertas activas** en header
- **Widget de stock bajo** en dashboard principal
- **Lista de productos críticos**

### 3.6 Predicciones de Consumo
#### Cálculo de Promedio:
- **Últimos 30 días** de movimientos tipo 'consumo_automatico'
- **Promedio diario** por producto
- **Consideración de estacionalidad** (opcional: últimos 90 días con peso)

#### Predicción Futura:
- **Tareas programadas** próximas 30 días
- **Consumo estimado** basado en property_consumption_config
- **Fecha estimada de agotamiento** por producto
- **Sugerencias de pedido** para mantener stock óptimo

### 3.7 Reportes y Analytics
- **Consumo por período** (diario, semanal, mensual)
- **Consumo por propiedad**
- **Eficiencia de stock** (rotación, días de inventario)
- **Costos de inventario** (si se registra cost_per_unit)
- **Exportación a Excel** de todos los reportes

## 4. INTERFAZ DE USUARIO

### 4.1 Navegación
- **Nueva sección en sidebar**: "Inventario" con submódulos:
  - Dashboard de Inventario
  - Stock Actual
  - Movimientos
  - Configuración de Productos
  - Configuración de Consumo
  - Reportes

### 4.2 Dashboard de Inventario
- **Widgets principales**:
  - Alertas de stock bajo
  - Productos más consumidos
  - Predicciones críticas
  - Resumen de movimientos recientes
- **Gráficos**:
  - Evolución de stock por producto
  - Consumo mensual por categoría
  - Predicciones vs. realidad

### 4.3 Gestión de Stock
- **Vista de tabla** con filtros por categoría
- **Acciones rápidas**: ajustar stock, ver historial
- **Modal de entrada de stock**: producto, cantidad, comentario
- **Modal de ajuste**: diferencia, razón obligatoria
- **Vista detalle por producto**: gráfico de evolución, movimientos

### 4.4 Configuración de Consumo
- **Vista por propiedad**: tabla editable de consumos
- **Vista por producto**: qué propiedades lo consumen
- **Plantillas**: aplicar configuración a múltiples propiedades
- **Calculadora de consumo**: estimación basada en reservas

## 5. PERMISOS Y ROLES

### 5.1 Administradores y Managers
- **Acceso completo** a todas las funcionalidades
- **Configuración** de productos y categorías
- **Gestión de stock** (entradas, ajustes)
- **Configuración de consumo**
- **Acceso a todos los reportes**

### 5.2 Supervisores
- **Solo lectura** de stock actual
- **Consulta de reportes**
- **NO pueden** hacer ajustes de stock

### 5.3 Limpiadoras
- **Sin acceso** al módulo de inventario

## 6. IMPLEMENTACIÓN TÉCNICA

### 6.1 Base de Datos
- **Migraciones SQL** para crear todas las tablas
- **Políticas RLS** según los permisos definidos
- **Triggers** para actualizar stock automáticamente
- **Funciones** para cálculos de predicciones

### 6.2 Backend (Edge Functions)
- **inventory-consumption**: procesar consumo automático al completar tareas
- **inventory-alerts**: verificar y enviar alertas de stock
- **inventory-predictions**: calcular predicciones de consumo
- **inventory-reports**: generar reportes complejos

### 6.3 Frontend
- **Hooks específicos**: useInventory, useInventoryMovements, useInventoryAlerts
- **Componentes reutilizables**: InventoryTable, StockWidget, MovementHistory
- **Forms**: StockAdjustment, ProductConfiguration, ConsumptionConfig
- **Servicios**: inventoryStorage, alertsService, predictionsService

### 6.4 Integraciones
- **Sistema de tareas existente**: hook al completar tareas
- **Sistema de notificaciones**: emails para alertas
- **Dashboard principal**: widgets de alertas
- **Sistema de propiedades**: configuración automática de consumo

## 7. FASES DE IMPLEMENTACIÓN

### Fase 1: Estructura Base
1. Crear tablas de base de datos
2. Implementar CRUD básico de categorías y productos
3. Sistema básico de stock actual
4. Navegación en sidebar

### Fase 2: Consumo Automático
1. Configuración de consumo por propiedad
2. Auto-configuración desde datos de properties
3. Trigger de consumo al completar tareas
4. Historial de movimientos

### Fase 3: Alertas y Gestión
1. Sistema de alertas (email + dashboard)
2. Gestión manual de stock (entradas, ajustes)
3. Widgets en dashboard principal
4. Permisos y validaciones

### Fase 4: Analytics y Optimización
1. Predicciones de consumo
2. Reportes avanzados
3. Optimización de rendimiento
4. Exportación de datos

## 8. CONSIDERACIONES TÉCNICAS

### 8.1 Performance
- **Índices** en tablas principales para consultas frecuentes
- **Caché** de cálculos de predicciones
- **Paginación** en historiales largos
- **Lazy loading** de componentes pesados

### 8.2 Escalabilidad
- **Soft deletes** en lugar de eliminación física
- **Archivado** de movimientos antiguos
- **Compresión** de datos históricos
- **API pagination** para grandes volúmenes

### 8.3 Seguridad
- **Validación** de cantidades positivas/negativas según tipo
- **Auditoría** de todos los cambios manuales
- **Límites** de ajuste de stock por rol
- **Confirmación** para ajustes grandes

Este sistema proporcionará un control completo y automatizado del inventario, minimizando el trabajo manual y maximizando la precisión en el control de stock.