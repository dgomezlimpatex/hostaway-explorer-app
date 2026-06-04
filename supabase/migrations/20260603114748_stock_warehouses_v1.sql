-- New professional stock module.
-- The existing inventory_* tables are legacy and intentionally left untouched.

CREATE TYPE public.stock_item_kind AS ENUM ('laundry', 'amenity', 'other');
CREATE TYPE public.stock_movement_type AS ENUM (
  'entrada',
  'salida',
  'ajuste',
  'consumo_automatico',
  'transferencia'
);
CREATE TYPE public.stock_alert_type AS ENUM ('stock_bajo', 'stock_critico');

CREATE TABLE public.stock_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_warehouses_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT stock_warehouses_sede_name_unique UNIQUE (sede_id, name)
);

CREATE UNIQUE INDEX stock_warehouses_one_default_per_sede
ON public.stock_warehouses(sede_id)
WHERE is_default = true;

CREATE TABLE public.stock_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.stock_item_kind NOT NULL DEFAULT 'other',
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_categories_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT stock_categories_kind_name_unique UNIQUE (kind, name)
);

CREATE TABLE public.stock_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.stock_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'unidades',
  sku TEXT,
  is_consumable BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_products_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT stock_products_unit_not_blank CHECK (length(trim(unit_of_measure)) > 0),
  CONSTRAINT stock_products_sede_name_unique UNIQUE (sede_id, name),
  CONSTRAINT stock_products_sede_sku_unique UNIQUE (sede_id, sku)
);

CREATE TABLE public.stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.stock_warehouses(id) ON DELETE CASCADE,
  current_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  minimum_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  target_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(12, 4),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT stock_levels_product_warehouse_unique UNIQUE (product_id, warehouse_id),
  CONSTRAINT stock_levels_non_negative CHECK (
    current_quantity >= 0
    AND minimum_quantity >= 0
    AND target_quantity >= 0
    AND (cost_per_unit IS NULL OR cost_per_unit >= 0)
  ),
  CONSTRAINT stock_levels_target_gte_minimum CHECK (target_quantity >= minimum_quantity)
);

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.stock_warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id UUID REFERENCES public.stock_warehouses(id) ON DELETE RESTRICT,
  movement_type public.stock_movement_type NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL,
  previous_quantity NUMERIC(12, 2) NOT NULL,
  new_quantity NUMERIC(12, 2) NOT NULL,
  to_previous_quantity NUMERIC(12, 2),
  to_new_quantity NUMERIC(12, 2),
  reason TEXT NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_quantity_positive CHECK (quantity > 0),
  CONSTRAINT stock_movements_reason_not_blank CHECK (length(trim(reason)) > 0),
  CONSTRAINT stock_movements_transfer_target CHECK (
    (movement_type = 'transferencia' AND to_warehouse_id IS NOT NULL AND warehouse_id <> to_warehouse_id)
    OR (movement_type <> 'transferencia' AND to_warehouse_id IS NULL)
  ),
  CONSTRAINT stock_movements_transfer_quantities CHECK (
    (movement_type = 'transferencia' AND to_previous_quantity IS NOT NULL AND to_new_quantity IS NOT NULL)
    OR (movement_type <> 'transferencia' AND to_previous_quantity IS NULL AND to_new_quantity IS NULL)
  )
);

CREATE TABLE public.stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_level_id UUID NOT NULL REFERENCES public.stock_levels(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.stock_warehouses(id) ON DELETE CASCADE,
  alert_type public.stock_alert_type NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notified_users JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE UNIQUE INDEX stock_alerts_one_active_per_level_type
ON public.stock_alerts(stock_level_id, alert_type)
WHERE is_active = true;

CREATE TABLE public.stock_property_consumption_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.stock_warehouses(id) ON DELETE SET NULL,
  quantity_per_cleaning NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_consumption_rules_quantity_non_negative CHECK (quantity_per_cleaning >= 0),
  CONSTRAINT stock_consumption_rules_unique UNIQUE (property_id, product_id)
);

CREATE TABLE public.stock_property_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  property_field TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.stock_warehouses(id) ON DELETE SET NULL,
  multiplier NUMERIC(12, 2) NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_field_mappings_field_not_blank CHECK (length(trim(property_field)) > 0),
  CONSTRAINT stock_field_mappings_multiplier_positive CHECK (multiplier > 0),
  CONSTRAINT stock_field_mappings_unique UNIQUE (sede_id, property_field, product_id)
);

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS default_stock_warehouse_id UUID REFERENCES public.stock_warehouses(id) ON DELETE SET NULL;

CREATE INDEX stock_warehouses_sede_idx ON public.stock_warehouses(sede_id);
CREATE INDEX stock_categories_kind_idx ON public.stock_categories(kind);
CREATE INDEX stock_products_sede_idx ON public.stock_products(sede_id);
CREATE INDEX stock_products_category_idx ON public.stock_products(category_id);
CREATE INDEX stock_levels_product_idx ON public.stock_levels(product_id);
CREATE INDEX stock_levels_warehouse_idx ON public.stock_levels(warehouse_id);
CREATE INDEX stock_movements_product_idx ON public.stock_movements(product_id);
CREATE INDEX stock_movements_warehouse_idx ON public.stock_movements(warehouse_id);
CREATE INDEX stock_movements_to_warehouse_idx ON public.stock_movements(to_warehouse_id);
CREATE INDEX stock_movements_task_idx ON public.stock_movements(task_id);
CREATE INDEX stock_movements_property_idx ON public.stock_movements(property_id);
CREATE INDEX stock_movements_created_at_idx ON public.stock_movements(created_at DESC);
CREATE INDEX stock_alerts_active_idx ON public.stock_alerts(is_active);
CREATE INDEX stock_consumption_rules_property_idx ON public.stock_property_consumption_rules(property_id);
CREATE INDEX stock_consumption_rules_product_idx ON public.stock_property_consumption_rules(product_id);
CREATE INDEX stock_field_mappings_sede_idx ON public.stock_property_field_mappings(sede_id);
CREATE INDEX stock_field_mappings_field_idx ON public.stock_property_field_mappings(property_field);
CREATE INDEX properties_default_stock_warehouse_idx ON public.properties(default_stock_warehouse_id);

CREATE TRIGGER update_stock_warehouses_updated_at
BEFORE UPDATE ON public.stock_warehouses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_categories_updated_at
BEFORE UPDATE ON public.stock_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_products_updated_at
BEFORE UPDATE ON public.stock_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_stock_levels_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_stock_levels_timestamp
BEFORE UPDATE ON public.stock_levels
FOR EACH ROW
EXECUTE FUNCTION public.update_stock_levels_timestamp();

CREATE TRIGGER update_stock_consumption_rules_updated_at
BEFORE UPDATE ON public.stock_property_consumption_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_field_mappings_updated_at
BEFORE UPDATE ON public.stock_property_field_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.stock_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_property_consumption_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_property_field_mappings ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON TYPE public.stock_item_kind TO anon, authenticated, service_role;
GRANT USAGE ON TYPE public.stock_movement_type TO anon, authenticated, service_role;
GRANT USAGE ON TYPE public.stock_alert_type TO anon, authenticated, service_role;

GRANT SELECT ON public.stock_warehouses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_warehouses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_warehouses TO authenticated;

GRANT SELECT ON public.stock_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_categories TO authenticated;

GRANT SELECT ON public.stock_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_products TO authenticated;

GRANT SELECT ON public.stock_levels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_levels TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_levels TO authenticated;

GRANT SELECT ON public.stock_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;

GRANT SELECT ON public.stock_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_alerts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_alerts TO authenticated;

GRANT SELECT ON public.stock_property_consumption_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_property_consumption_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_property_consumption_rules TO authenticated;

GRANT SELECT ON public.stock_property_field_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_property_field_mappings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_property_field_mappings TO authenticated;

CREATE POLICY "stock_warehouses_admin_manager_all"
ON public.stock_warehouses
FOR ALL TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
)
WITH CHECK (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
);

CREATE POLICY "stock_warehouses_supervisor_read"
ON public.stock_warehouses
FOR SELECT TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'supervisor'::public.app_role)));

CREATE POLICY "stock_categories_admin_manager_all"
ON public.stock_categories
FOR ALL TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
)
WITH CHECK (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
);

CREATE POLICY "stock_categories_supervisor_read"
ON public.stock_categories
FOR SELECT TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'supervisor'::public.app_role)));

CREATE POLICY "stock_products_admin_manager_all"
ON public.stock_products
FOR ALL TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
)
WITH CHECK (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
);

CREATE POLICY "stock_products_supervisor_read"
ON public.stock_products
FOR SELECT TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'supervisor'::public.app_role)));

CREATE POLICY "stock_levels_admin_manager_all"
ON public.stock_levels
FOR ALL TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
)
WITH CHECK (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
);

CREATE POLICY "stock_levels_supervisor_read"
ON public.stock_levels
FOR SELECT TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'supervisor'::public.app_role)));

CREATE POLICY "stock_movements_admin_manager_all"
ON public.stock_movements
FOR ALL TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
)
WITH CHECK (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
);

CREATE POLICY "stock_movements_supervisor_read"
ON public.stock_movements
FOR SELECT TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'supervisor'::public.app_role)));

CREATE POLICY "stock_alerts_admin_manager_all"
ON public.stock_alerts
FOR ALL TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
)
WITH CHECK (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
);

CREATE POLICY "stock_alerts_supervisor_read"
ON public.stock_alerts
FOR SELECT TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'supervisor'::public.app_role)));

CREATE POLICY "stock_consumption_rules_admin_manager_all"
ON public.stock_property_consumption_rules
FOR ALL TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
)
WITH CHECK (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
);

CREATE POLICY "stock_consumption_rules_supervisor_read"
ON public.stock_property_consumption_rules
FOR SELECT TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'supervisor'::public.app_role)));

CREATE POLICY "stock_field_mappings_admin_manager_all"
ON public.stock_property_field_mappings
FOR ALL TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
)
WITH CHECK (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
);

CREATE POLICY "stock_field_mappings_supervisor_read"
ON public.stock_property_field_mappings
FOR SELECT TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'supervisor'::public.app_role)));

INSERT INTO public.stock_categories (kind, name, description, sort_order)
VALUES
  ('laundry', 'Ropa de cama', 'Textiles de cama para apartamentos y suites', 10),
  ('laundry', 'Toallas', 'Toallas y alfombrines de bano', 20),
  ('amenity', 'Bano', 'Amenities y consumibles de bano', 30),
  ('amenity', 'Cocina', 'Amenities y consumibles de cocina', 40),
  ('amenity', 'Alimentacion', 'Kits y productos alimentarios de bienvenida', 50),
  ('other', 'Otros', 'Otros productos de stock', 999)
ON CONFLICT (kind, name) DO NOTHING;

INSERT INTO public.stock_warehouses (sede_id, name, is_default, sort_order)
SELECT s.id, 'Principal', true, 10
FROM public.sedes s
ON CONFLICT (sede_id, name) DO NOTHING;

WITH default_products AS (
  SELECT *
  FROM (VALUES
    ('laundry'::public.stock_item_kind, 'Ropa de cama', 'Sabanas matrimonio', 'unidades', 10),
    ('laundry'::public.stock_item_kind, 'Ropa de cama', 'Sabanas individuales', 'unidades', 20),
    ('laundry'::public.stock_item_kind, 'Ropa de cama', 'Sabanas suite', 'unidades', 30),
    ('laundry'::public.stock_item_kind, 'Ropa de cama', 'Fundas de almohada', 'unidades', 40),
    ('laundry'::public.stock_item_kind, 'Toallas', 'Toallas grandes', 'unidades', 50),
    ('laundry'::public.stock_item_kind, 'Toallas', 'Toallas pequenas', 'unidades', 60),
    ('laundry'::public.stock_item_kind, 'Toallas', 'Alfombrines ducha', 'unidades', 70),
    ('amenity'::public.stock_item_kind, 'Bano', 'Amenities bano', 'unidades', 80),
    ('amenity'::public.stock_item_kind, 'Cocina', 'Amenities cocina', 'unidades', 90),
    ('amenity'::public.stock_item_kind, 'Bano', 'Papel higienico', 'rollos', 100),
    ('amenity'::public.stock_item_kind, 'Cocina', 'Papel cocina', 'rollos', 110),
    ('amenity'::public.stock_item_kind, 'Alimentacion', 'Kit alimentario', 'unidades', 120),
    ('amenity'::public.stock_item_kind, 'Cocina', 'Bayetas cocina', 'unidades', 130),
    ('amenity'::public.stock_item_kind, 'Cocina', 'Bolsas basura', 'unidades', 140)
  ) AS p(kind, category_name, product_name, unit_of_measure, sort_order)
)
INSERT INTO public.stock_products (sede_id, category_id, name, unit_of_measure, sort_order)
SELECT s.id, c.id, p.product_name, p.unit_of_measure, p.sort_order
FROM public.sedes s
CROSS JOIN default_products p
JOIN public.stock_categories c
  ON c.kind = p.kind
 AND c.name = p.category_name
ON CONFLICT (sede_id, name) DO NOTHING;

INSERT INTO public.stock_levels (product_id, warehouse_id, current_quantity, minimum_quantity, target_quantity)
SELECT p.id, w.id, 0, 0, 0
FROM public.stock_products p
JOIN public.stock_warehouses w
  ON w.sede_id = p.sede_id
 AND w.is_default = true
ON CONFLICT (product_id, warehouse_id) DO NOTHING;

WITH field_map AS (
  SELECT *
  FROM (VALUES
    ('numero_sabanas', 'Sabanas matrimonio'),
    ('numero_sabanas_pequenas', 'Sabanas individuales'),
    ('numero_sabanas_suite', 'Sabanas suite'),
    ('numero_fundas_almohada', 'Fundas de almohada'),
    ('numero_toallas_grandes', 'Toallas grandes'),
    ('numero_toallas_pequenas', 'Toallas pequenas'),
    ('numero_alfombrines', 'Alfombrines ducha'),
    ('amenities_bano', 'Amenities bano'),
    ('amenities_cocina', 'Amenities cocina'),
    ('cantidad_rollos_papel_higienico', 'Papel higienico'),
    ('cantidad_rollos_papel_cocina', 'Papel cocina'),
    ('kit_alimentario', 'Kit alimentario'),
    ('bayetas_cocina', 'Bayetas cocina'),
    ('bolsas_basura', 'Bolsas basura')
  ) AS m(property_field, product_name)
)
INSERT INTO public.stock_property_field_mappings (sede_id, property_field, product_id)
SELECT p.sede_id, m.property_field, p.id
FROM field_map m
JOIN public.stock_products p
  ON p.name = m.product_name
ON CONFLICT (sede_id, property_field, product_id) DO NOTHING;

UPDATE public.properties p
SET default_stock_warehouse_id = w.id
FROM public.stock_warehouses w
WHERE p.default_stock_warehouse_id IS NULL
  AND p.sede_id = w.sede_id
  AND w.is_default = true;

COMMENT ON TABLE public.stock_warehouses IS 'New stock module: warehouses per sede. Legacy inventory_* tables are intentionally not used.';
COMMENT ON TABLE public.stock_categories IS 'New stock module categories classified as laundry, amenity or other.';
COMMENT ON TABLE public.stock_products IS 'New stock module product catalog, scoped by sede.';
COMMENT ON TABLE public.stock_levels IS 'Current stock by product and warehouse.';
COMMENT ON TABLE public.stock_movements IS 'Audit trail of stock movements. Quantities are always positive; movement_type defines direction.';
COMMENT ON TABLE public.stock_property_consumption_rules IS 'Property-specific stock consumption overrides.';
COMMENT ON TABLE public.stock_property_field_mappings IS 'Default mapping from property fields to stock products for automatic consumption.';
