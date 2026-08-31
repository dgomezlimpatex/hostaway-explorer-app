-- Habilitar RLS en todas las tablas de inventario
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_consumption_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas para inventory_categories
CREATE POLICY "Admin y managers pueden gestionar categorías"
ON public.inventory_categories
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'manager')
    )
);

-- Políticas para inventory_products
CREATE POLICY "Admin y managers pueden gestionar productos"
ON public.inventory_products
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'manager')
    )
);

-- Políticas para inventory_stock
CREATE POLICY "Admin y managers pueden gestionar stock"
ON public.inventory_stock
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'manager')
    )
);

CREATE POLICY "Supervisores pueden ver stock"
ON public.inventory_stock
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.role = 'supervisor'
    )
);

-- Políticas para property_consumption_config
CREATE POLICY "Admin y managers pueden gestionar configuración de consumo"
ON public.property_consumption_config
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'manager')
    )
);

-- Políticas para inventory_movements
CREATE POLICY "Admin y managers pueden gestionar movimientos"
ON public.inventory_movements
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'manager')
    )
);

CREATE POLICY "Supervisores pueden ver movimientos"
ON public.inventory_movements
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.role = 'supervisor'
    )
);

-- Políticas para inventory_alerts
CREATE POLICY "Admin y managers pueden gestionar alertas"
ON public.inventory_alerts
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'manager')
    )
);

CREATE POLICY "Supervisores pueden ver alertas"
ON public.inventory_alerts
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.role = 'supervisor'
    )
);