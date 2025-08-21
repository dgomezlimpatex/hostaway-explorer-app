-- =========================================
-- FASE 1.2: MODIFICACIÓN DE TABLAS PRINCIPALES - AGREGAR SEDE_ID
-- =========================================

-- Obtener ID de la sede principal para la migración de datos
DO $$
DECLARE
    sede_principal_id UUID;
BEGIN
    -- Obtener el ID de la sede principal
    SELECT id INTO sede_principal_id FROM public.sedes WHERE codigo = 'PRINCIPAL' LIMIT 1;
    
    -- Si no existe, crear la sede principal
    IF sede_principal_id IS NULL THEN
        INSERT INTO public.sedes (nombre, codigo, ciudad, direccion, is_active)
        VALUES ('Sede Principal', 'PRINCIPAL', 'Ciudad Principal', 'Dirección de la sede principal', true)
        RETURNING id INTO sede_principal_id;
    END IF;

    -- =========================================
    -- AGREGAR SEDE_ID A TABLA CLIENTS
    -- =========================================
    
    -- Agregar columna sede_id a clients
    ALTER TABLE public.clients ADD COLUMN sede_id UUID REFERENCES public.sedes(id);
    
    -- Asignar todos los clientes existentes a la sede principal
    UPDATE public.clients SET sede_id = sede_principal_id WHERE sede_id IS NULL;
    
    -- Hacer sede_id NOT NULL después de la migración
    ALTER TABLE public.clients ALTER COLUMN sede_id SET NOT NULL;

    -- =========================================
    -- AGREGAR SEDE_ID A TABLA PROPERTIES
    -- =========================================
    
    -- Agregar columna sede_id a properties
    ALTER TABLE public.properties ADD COLUMN sede_id UUID REFERENCES public.sedes(id);
    
    -- Asignar todas las propiedades existentes a la sede principal
    UPDATE public.properties SET sede_id = sede_principal_id WHERE sede_id IS NULL;
    
    -- Hacer sede_id NOT NULL después de la migración
    ALTER TABLE public.properties ALTER COLUMN sede_id SET NOT NULL;

    -- =========================================
    -- AGREGAR SEDE_ID A TABLA CLEANERS
    -- =========================================
    
    -- Agregar columna sede_id a cleaners
    ALTER TABLE public.cleaners ADD COLUMN sede_id UUID REFERENCES public.sedes(id);
    
    -- Asignar todos los limpiadores existentes a la sede principal
    UPDATE public.cleaners SET sede_id = sede_principal_id WHERE sede_id IS NULL;
    
    -- Hacer sede_id NOT NULL después de la migración
    ALTER TABLE public.cleaners ALTER COLUMN sede_id SET NOT NULL;

    -- =========================================
    -- AGREGAR SEDE_ID A TABLA TASKS
    -- =========================================
    
    -- Agregar columna sede_id a tasks
    ALTER TABLE public.tasks ADD COLUMN sede_id UUID REFERENCES public.sedes(id);
    
    -- Asignar todas las tareas existentes a la sede principal
    UPDATE public.tasks SET sede_id = sede_principal_id WHERE sede_id IS NULL;
    
    -- Hacer sede_id NOT NULL después de la migración
    ALTER TABLE public.tasks ALTER COLUMN sede_id SET NOT NULL;

    -- =========================================
    -- AGREGAR SEDE_ID A TABLA INVENTORY_PRODUCTS
    -- =========================================
    
    -- Agregar columna sede_id a inventory_products
    ALTER TABLE public.inventory_products ADD COLUMN sede_id UUID REFERENCES public.sedes(id);
    
    -- Asignar todos los productos existentes a la sede principal
    UPDATE public.inventory_products SET sede_id = sede_principal_id WHERE sede_id IS NULL;
    
    -- Hacer sede_id NOT NULL después de la migración
    ALTER TABLE public.inventory_products ALTER COLUMN sede_id SET NOT NULL;

    -- =========================================
    -- AGREGAR SEDE_ID A TABLA INVENTORY_STOCK
    -- =========================================
    
    -- Agregar columna sede_id a inventory_stock
    ALTER TABLE public.inventory_stock ADD COLUMN sede_id UUID REFERENCES public.sedes(id);
    
    -- Asignar todo el stock existente a la sede principal
    UPDATE public.inventory_stock SET sede_id = sede_principal_id WHERE sede_id IS NULL;
    
    -- Hacer sede_id NOT NULL después de la migración
    ALTER TABLE public.inventory_stock ALTER COLUMN sede_id SET NOT NULL;

    -- =========================================
    -- AGREGAR SEDE_ID A TABLA LOGISTICS_PICKLISTS
    -- =========================================
    
    -- Agregar columna sede_id a logistics_picklists
    ALTER TABLE public.logistics_picklists ADD COLUMN sede_id UUID REFERENCES public.sedes(id);
    
    -- Asignar todas las listas existentes a la sede principal
    UPDATE public.logistics_picklists SET sede_id = sede_principal_id WHERE sede_id IS NULL;
    
    -- Hacer sede_id NOT NULL después de la migración
    ALTER TABLE public.logistics_picklists ALTER COLUMN sede_id SET NOT NULL;

    -- =========================================
    -- AGREGAR SEDE_ID A TABLA LOGISTICS_DELIVERIES
    -- =========================================
    
    -- Agregar columna sede_id a logistics_deliveries
    ALTER TABLE public.logistics_deliveries ADD COLUMN sede_id UUID REFERENCES public.sedes(id);
    
    -- Asignar todas las entregas existentes a la sede principal
    UPDATE public.logistics_deliveries SET sede_id = sede_principal_id WHERE sede_id IS NULL;
    
    -- Hacer sede_id NOT NULL después de la migración
    ALTER TABLE public.logistics_deliveries ALTER COLUMN sede_id SET NOT NULL;

    -- =========================================
    -- AGREGAR SEDE_ID A TABLA RECURRING_TASKS
    -- =========================================
    
    -- Agregar columna sede_id a recurring_tasks
    ALTER TABLE public.recurring_tasks ADD COLUMN sede_id UUID REFERENCES public.sedes(id);
    
    -- Asignar todas las tareas recurrentes existentes a la sede principal
    UPDATE public.recurring_tasks SET sede_id = sede_principal_id WHERE sede_id IS NULL;
    
    -- Hacer sede_id NOT NULL después de la migración
    ALTER TABLE public.recurring_tasks ALTER COLUMN sede_id SET NOT NULL;

END $$;

-- =========================================
-- CREAR ÍNDICES PARA OPTIMIZAR PERFORMANCE
-- =========================================

-- Índices para optimizar consultas por sede
CREATE INDEX idx_clients_sede_id ON public.clients(sede_id);
CREATE INDEX idx_properties_sede_id ON public.properties(sede_id);
CREATE INDEX idx_cleaners_sede_id ON public.cleaners(sede_id);
CREATE INDEX idx_tasks_sede_id ON public.tasks(sede_id);
CREATE INDEX idx_inventory_products_sede_id ON public.inventory_products(sede_id);
CREATE INDEX idx_inventory_stock_sede_id ON public.inventory_stock(sede_id);
CREATE INDEX idx_logistics_picklists_sede_id ON public.logistics_picklists(sede_id);
CREATE INDEX idx_logistics_deliveries_sede_id ON public.logistics_deliveries(sede_id);
CREATE INDEX idx_recurring_tasks_sede_id ON public.recurring_tasks(sede_id);

-- Índice compuesto para user_sede_access
CREATE INDEX idx_user_sede_access_user_sede ON public.user_sede_access(user_id, sede_id);

-- =========================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =========================================

COMMENT ON COLUMN public.clients.sede_id IS 'ID de la sede a la que pertenece el cliente';
COMMENT ON COLUMN public.properties.sede_id IS 'ID de la sede a la que pertenece la propiedad';
COMMENT ON COLUMN public.cleaners.sede_id IS 'ID de la sede a la que pertenece el limpiador';
COMMENT ON COLUMN public.tasks.sede_id IS 'ID de la sede a la que pertenece la tarea';
COMMENT ON COLUMN public.inventory_products.sede_id IS 'ID de la sede a la que pertenece el producto';
COMMENT ON COLUMN public.inventory_stock.sede_id IS 'ID de la sede a la que pertenece el stock';
COMMENT ON COLUMN public.logistics_picklists.sede_id IS 'ID de la sede a la que pertenece la lista de picking';
COMMENT ON COLUMN public.logistics_deliveries.sede_id IS 'ID de la sede a la que pertenece la entrega';
COMMENT ON COLUMN public.recurring_tasks.sede_id IS 'ID de la sede a la que pertenece la tarea recurrente';