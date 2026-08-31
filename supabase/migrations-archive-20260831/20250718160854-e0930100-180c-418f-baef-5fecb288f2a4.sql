-- Crear enum para tipos de movimiento de inventario
CREATE TYPE public.inventory_movement_type AS ENUM (
    'entrada',
    'salida', 
    'ajuste',
    'consumo_automatico'
);

-- Crear enum para tipos de alerta de inventario
CREATE TYPE public.inventory_alert_type AS ENUM (
    'stock_bajo',
    'stock_critico'
);

-- Tabla de categorías de inventario
CREATE TABLE public.inventory_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(name)
);

-- Tabla de productos de inventario
CREATE TABLE public.inventory_products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES public.inventory_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    unit_of_measure TEXT NOT NULL DEFAULT 'unidades',
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(category_id, name)
);

-- Tabla de stock actual
CREATE TABLE public.inventory_stock (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL UNIQUE REFERENCES public.inventory_products(id) ON DELETE CASCADE,
    current_quantity INTEGER NOT NULL DEFAULT 0,
    minimum_stock INTEGER NOT NULL DEFAULT 0,
    maximum_stock INTEGER NOT NULL DEFAULT 0,
    cost_per_unit DECIMAL(10,2),
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID NOT NULL,
    CONSTRAINT positive_quantities CHECK (current_quantity >= 0 AND minimum_stock >= 0 AND maximum_stock >= 0),
    CONSTRAINT min_max_stock CHECK (maximum_stock >= minimum_stock)
);

-- Tabla de configuración de consumo por propiedad
CREATE TABLE public.property_consumption_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
    quantity_per_cleaning INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(property_id, product_id),
    CONSTRAINT positive_quantity CHECK (quantity_per_cleaning >= 0)
);

-- Tabla de movimientos de inventario
CREATE TABLE public.inventory_movements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
    movement_type public.inventory_movement_type NOT NULL,
    quantity INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT quantity_logic CHECK (
        (movement_type IN ('entrada', 'ajuste') AND quantity != 0) OR
        (movement_type IN ('salida', 'consumo_automatico') AND quantity < 0)
    )
);

-- Tabla de alertas de stock
CREATE TABLE public.inventory_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
    alert_type public.inventory_alert_type NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notified_users JSONB NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE(product_id, alert_type, is_active) WHERE is_active = true
);

-- Crear índices para optimizar consultas
CREATE INDEX idx_inventory_products_category ON public.inventory_products(category_id);
CREATE INDEX idx_inventory_products_active ON public.inventory_products(is_active);
CREATE INDEX idx_inventory_stock_product ON public.inventory_stock(product_id);
CREATE INDEX idx_property_consumption_property ON public.property_consumption_config(property_id);
CREATE INDEX idx_property_consumption_product ON public.property_consumption_config(product_id);
CREATE INDEX idx_inventory_movements_product ON public.inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_date ON public.inventory_movements(created_at);
CREATE INDEX idx_inventory_movements_task ON public.inventory_movements(task_id);
CREATE INDEX idx_inventory_alerts_active ON public.inventory_alerts(is_active);
CREATE INDEX idx_inventory_alerts_product ON public.inventory_alerts(product_id);

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_inventory_categories_updated_at
    BEFORE UPDATE ON public.inventory_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_products_updated_at
    BEFORE UPDATE ON public.inventory_products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_property_consumption_config_updated_at
    BEFORE UPDATE ON public.property_consumption_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Función para actualizar last_updated en inventory_stock
CREATE OR REPLACE FUNCTION public.update_inventory_stock_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_stock_timestamp
    BEFORE UPDATE ON public.inventory_stock
    FOR EACH ROW
    EXECUTE FUNCTION public.update_inventory_stock_timestamp();

-- Insertar categorías predefinidas
INSERT INTO public.inventory_categories (name, description, sort_order) VALUES
    ('Ropa de Cama', 'Textiles para habitaciones', 1),
    ('Amenities Baño', 'Productos de aseo personal', 2),
    ('Amenities Cocina', 'Productos para la cocina', 3),
    ('Amenities Alimentarios', 'Productos alimentarios de bienvenida', 4);

-- Insertar productos predefinidos de ropa de cama
INSERT INTO public.inventory_products (category_id, name, description, sort_order) 
SELECT c.id, p.name, p.description, p.sort_order
FROM public.inventory_categories c
CROSS JOIN (VALUES
    ('Sábanas', 'Juegos de sábanas para camas', 1),
    ('Fundas de Almohada', 'Fundas para almohadas', 2),
    ('Toallas Grandes', 'Toallas de baño grandes', 3),
    ('Toallas Pequeñas', 'Toallas de mano y cara', 4),
    ('Alfombrines de Ducha', 'Alfombrillas antideslizantes para ducha', 5)
) AS p(name, description, sort_order)
WHERE c.name = 'Ropa de Cama';