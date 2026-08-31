-- Crear índices para optimizar queries por sede_id
-- Estos índices mejorarán significativamente la performance de las consultas filtradas por sede

-- Índices para las tablas principales con sede_id
CREATE INDEX IF NOT EXISTS idx_clients_sede_id ON public.clients(sede_id);
CREATE INDEX IF NOT EXISTS idx_properties_sede_id ON public.properties(sede_id);
CREATE INDEX IF NOT EXISTS idx_cleaners_sede_id ON public.cleaners(sede_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sede_id ON public.tasks(sede_id) WHERE sede_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_products_sede_id ON public.inventory_products(sede_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_sede_id ON public.inventory_stock(sede_id);
CREATE INDEX IF NOT EXISTS idx_logistics_picklists_sede_id ON public.logistics_picklists(sede_id);
CREATE INDEX IF NOT EXISTS idx_logistics_deliveries_sede_id ON public.logistics_deliveries(sede_id);

-- Índices compuestos para queries comunes
CREATE INDEX IF NOT EXISTS idx_clients_sede_active ON public.clients(sede_id, fecha_actualizacion) WHERE sede_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_sede_client ON public.properties(sede_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_cleaners_sede_active ON public.cleaners(sede_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_sede_product ON public.inventory_stock(sede_id, product_id);

-- Índice para user_sede_access para optimizar verificaciones de permisos
CREATE INDEX IF NOT EXISTS idx_user_sede_access_user_sede ON public.user_sede_access(user_id, sede_id);
CREATE INDEX IF NOT EXISTS idx_user_sede_access_sede_access ON public.user_sede_access(sede_id, can_access);

-- Comentarios para documentar los índices
COMMENT ON INDEX idx_clients_sede_id IS 'Optimiza consultas de clientes filtradas por sede';
COMMENT ON INDEX idx_properties_sede_id IS 'Optimiza consultas de propiedades filtradas por sede';
COMMENT ON INDEX idx_cleaners_sede_id IS 'Optimiza consultas de limpiadores filtradas por sede';
COMMENT ON INDEX idx_tasks_sede_id IS 'Optimiza consultas de tareas filtradas por sede';
COMMENT ON INDEX idx_inventory_products_sede_id IS 'Optimiza consultas de productos filtradas por sede';
COMMENT ON INDEX idx_inventory_stock_sede_id IS 'Optimiza consultas de stock filtradas por sede';
COMMENT ON INDEX idx_logistics_picklists_sede_id IS 'Optimiza consultas de picklists filtradas por sede';
COMMENT ON INDEX idx_logistics_deliveries_sede_id IS 'Optimiza consultas de entregas filtradas por sede';
COMMENT ON INDEX idx_user_sede_access_user_sede IS 'Optimiza verificaciones de acceso de usuario a sede';