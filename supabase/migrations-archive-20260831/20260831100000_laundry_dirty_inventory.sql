-- Primer flujo operativo de lencería sucia.
-- La ropa limpia sigue viviendo en stock_levels; la ropa sucia tiene su propio saldo
-- para que ambos estados sean visibles y no se confundan.

CREATE TABLE IF NOT EXISTS public.laundry_dirty_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.stock_warehouses(id) ON DELETE CASCADE,
  current_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT laundry_dirty_stock_unique UNIQUE (product_id, warehouse_id),
  CONSTRAINT laundry_dirty_stock_non_negative CHECK (current_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS public.laundry_dirty_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.stock_warehouses(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL,
  previous_quantity NUMERIC(12, 2) NOT NULL,
  new_quantity NUMERIC(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT laundry_dirty_movements_type_valid CHECK (movement_type IN ('entrada', 'salida', 'ajuste')),
  CONSTRAINT laundry_dirty_movements_quantity_positive CHECK (quantity > 0),
  CONSTRAINT laundry_dirty_movements_reason_not_blank CHECK (length(trim(reason)) > 0),
  CONSTRAINT laundry_dirty_movements_quantities_non_negative CHECK (
    previous_quantity >= 0 AND new_quantity >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS laundry_dirty_auto_once
ON public.laundry_dirty_movements(task_id, product_id, warehouse_id)
WHERE task_id IS NOT NULL AND movement_type = 'entrada';

CREATE INDEX IF NOT EXISTS laundry_dirty_stock_product_idx
ON public.laundry_dirty_stock(product_id);

CREATE INDEX IF NOT EXISTS laundry_dirty_stock_warehouse_idx
ON public.laundry_dirty_stock(warehouse_id);

CREATE INDEX IF NOT EXISTS laundry_dirty_movements_created_at_idx
ON public.laundry_dirty_movements(created_at DESC);

CREATE INDEX IF NOT EXISTS laundry_dirty_movements_task_idx
ON public.laundry_dirty_movements(task_id);

CREATE OR REPLACE FUNCTION public.update_laundry_dirty_stock_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS update_laundry_dirty_stock_timestamp ON public.laundry_dirty_stock;

CREATE TRIGGER update_laundry_dirty_stock_timestamp
BEFORE UPDATE ON public.laundry_dirty_stock
FOR EACH ROW
EXECUTE FUNCTION public.update_laundry_dirty_stock_timestamp();

ALTER TABLE public.laundry_dirty_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_dirty_movements ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_dirty_stock TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_dirty_stock TO service_role;
GRANT SELECT ON public.laundry_dirty_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_dirty_movements TO service_role;

DROP POLICY IF EXISTS "laundry_dirty_stock_admin_manager_all" ON public.laundry_dirty_stock;
DROP POLICY IF EXISTS "laundry_dirty_movements_admin_manager_read" ON public.laundry_dirty_movements;

CREATE POLICY "laundry_dirty_stock_admin_manager_all"
ON public.laundry_dirty_stock
FOR ALL TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
)
WITH CHECK (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
);

CREATE POLICY "laundry_dirty_movements_admin_manager_read"
ON public.laundry_dirty_movements
FOR SELECT TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
);

CREATE OR REPLACE FUNCTION public.adjust_laundry_dirty_stock(
  product_id_param UUID,
  warehouse_id_param UUID,
  movement_type_param TEXT,
  quantity_param NUMERIC,
  reason_param TEXT,
  user_id_param UUID
)
RETURNS public.laundry_dirty_stock
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  product_record RECORD;
  warehouse_record RECORD;
  dirty_record public.laundry_dirty_stock;
  previous_quantity NUMERIC(12, 2);
  new_quantity NUMERIC(12, 2);
  movement_quantity NUMERIC(12, 2);
BEGIN
  IF product_id_param IS NULL
    OR warehouse_id_param IS NULL
    OR user_id_param IS NULL
    OR quantity_param IS NULL
  THEN
    RAISE EXCEPTION 'product, warehouse, quantity and user are required';
  END IF;

  IF auth.uid() IS NULL OR user_id_param <> auth.uid() THEN
    RAISE EXCEPTION 'The acting user must match the authenticated user';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'User not allowed to adjust dirty laundry stock';
  END IF;

  IF movement_type_param NOT IN ('entrada', 'salida', 'ajuste') THEN
    RAISE EXCEPTION 'Invalid dirty laundry movement type';
  END IF;

  IF quantity_param < 0 OR (movement_type_param <> 'ajuste' AND quantity_param = 0) THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  IF length(trim(COALESCE(reason_param, ''))) = 0 THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  SELECT p.id, p.sede_id, sc.kind
  INTO product_record
  FROM public.stock_products p
  JOIN public.stock_categories sc ON sc.id = p.category_id
  WHERE p.id = product_id_param
    AND p.is_active = true;

  IF product_record.id IS NULL OR product_record.kind <> 'laundry'::public.stock_item_kind THEN
    RAISE EXCEPTION 'Active laundry product not found';
  END IF;

  SELECT *
  INTO warehouse_record
  FROM public.stock_warehouses
  WHERE id = warehouse_id_param
    AND is_active = true;

  IF warehouse_record.id IS NULL OR warehouse_record.sede_id <> product_record.sede_id THEN
    RAISE EXCEPTION 'Product and warehouse must belong to the same sede';
  END IF;

  INSERT INTO public.laundry_dirty_stock (product_id, warehouse_id, current_quantity, updated_by)
  VALUES (product_id_param, warehouse_id_param, 0, user_id_param)
  ON CONFLICT (product_id, warehouse_id) DO NOTHING;

  SELECT *
  INTO dirty_record
  FROM public.laundry_dirty_stock
  WHERE product_id = product_id_param
    AND warehouse_id = warehouse_id_param
  FOR UPDATE;

  IF movement_type_param = 'entrada' THEN
    previous_quantity := dirty_record.current_quantity;
    new_quantity := dirty_record.current_quantity + quantity_param;
  ELSIF movement_type_param = 'salida' THEN
    IF dirty_record.current_quantity < quantity_param THEN
      RAISE EXCEPTION 'No hay suficiente ropa sucia para enviar esa cantidad';
    END IF;
    previous_quantity := dirty_record.current_quantity;
    new_quantity := dirty_record.current_quantity - quantity_param;
  ELSE
    previous_quantity := dirty_record.current_quantity;
    new_quantity := quantity_param;
  END IF;

  movement_quantity := CASE
    WHEN movement_type_param = 'ajuste' THEN abs(new_quantity - dirty_record.current_quantity)
    ELSE quantity_param
  END;

  IF movement_quantity <= 0 THEN
    RAISE EXCEPTION 'The adjustment does not change dirty laundry stock';
  END IF;

  UPDATE public.laundry_dirty_stock
  SET current_quantity = new_quantity,
      updated_by = user_id_param
  WHERE id = dirty_record.id
  RETURNING * INTO dirty_record;

  INSERT INTO public.laundry_dirty_movements (
    product_id,
    warehouse_id,
    movement_type,
    quantity,
    previous_quantity,
    new_quantity,
    reason,
    created_by
  )
  VALUES (
    product_id_param,
    warehouse_id_param,
    movement_type_param,
    movement_quantity,
    previous_quantity,
    new_quantity,
    trim(reason_param),
    user_id_param
  );

  RETURN dirty_record;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.adjust_laundry_dirty_stock(UUID, UUID, TEXT, NUMERIC, TEXT, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.adjust_laundry_dirty_stock(UUID, UUID, TEXT, NUMERIC, TEXT, UUID)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.process_laundry_dirty_for_task(
  task_id_param UUID,
  property_id_param UUID,
  user_id_param UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  property_data RECORD;
  task_data RECORD;
  consumption_record RECORD;
  dirty_record RECORD;
  warehouse_id_resolved UUID;
  quantity_to_add NUMERIC(12, 2);
  movement_reason TEXT;
  added_count INTEGER := 0;
  skipped_count INTEGER := 0;
BEGIN
  IF task_id_param IS NULL OR property_id_param IS NULL OR user_id_param IS NULL THEN
    RAISE EXCEPTION 'task_id, property_id and user_id are required';
  END IF;

  IF auth.uid() IS NULL OR user_id_param <> auth.uid() THEN
    RAISE EXCEPTION 'The acting user must match the authenticated user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_id_param
      AND role IN ('admin', 'manager', 'supervisor', 'cleaner')
  ) THEN
    RAISE EXCEPTION 'User not allowed to process dirty laundry';
  END IF;

  SELECT id, propiedad_id, sede_id, type, status
  INTO task_data
  FROM public.tasks
  WHERE id = task_id_param;

  IF task_data.id IS NULL
    OR task_data.propiedad_id <> property_id_param
    OR task_data.type <> 'limpieza-turistica'
    OR task_data.status <> 'completed'
  THEN
    RAISE EXCEPTION 'Completed cleaning task not found';
  END IF;

  SELECT *
  INTO property_data
  FROM public.properties
  WHERE id = property_id_param
    AND sede_id = task_data.sede_id;

  IF property_data.id IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  movement_reason := 'Ropa sucia por limpieza completada en '
    || COALESCE(property_data.nombre, property_data.codigo, property_id_param::TEXT);

  FOR consumption_record IN
    SELECT source.product_id, source.warehouse_id, SUM(source.quantity)::NUMERIC(12, 2) AS quantity
    FROM (
      SELECT
        r.product_id,
        r.warehouse_id,
        r.quantity_per_cleaning AS quantity
      FROM public.stock_property_consumption_rules r
      JOIN public.stock_products p ON p.id = r.product_id
      JOIN public.stock_categories sc ON sc.id = p.category_id
      WHERE r.property_id = property_id_param
        AND r.is_active = true
        AND p.sede_id = task_data.sede_id
        AND p.is_active = true
        AND sc.kind = 'laundry'::public.stock_item_kind

      UNION ALL

      SELECT
        m.product_id,
        m.warehouse_id,
        (
          CASE m.property_field
            WHEN 'numero_sabanas' THEN COALESCE(property_data.numero_sabanas, 0)
            WHEN 'numero_sabanas_pequenas' THEN COALESCE(property_data.numero_sabanas_pequenas, 0)
            WHEN 'numero_sabanas_suite' THEN COALESCE(property_data.numero_sabanas_suite, 0)
            WHEN 'numero_toallas_grandes' THEN COALESCE(property_data.numero_toallas_grandes, 0)
            WHEN 'numero_toallas_pequenas' THEN COALESCE(property_data.numero_toallas_pequenas, 0)
            WHEN 'numero_alfombrines' THEN COALESCE(property_data.numero_alfombrines, 0)
            WHEN 'numero_fundas_almohada' THEN COALESCE(property_data.numero_fundas_almohada, 0)
            ELSE 0
          END
        )::NUMERIC(12, 2) * m.multiplier AS quantity
      FROM public.stock_property_field_mappings m
      JOIN public.stock_products p ON p.id = m.product_id
      JOIN public.stock_categories sc ON sc.id = p.category_id
      WHERE m.sede_id = task_data.sede_id
        AND m.is_active = true
        AND p.is_active = true
        AND sc.kind = 'laundry'::public.stock_item_kind
        AND NOT EXISTS (
          SELECT 1
          FROM public.stock_property_consumption_rules r
          WHERE r.property_id = property_id_param
            AND r.product_id = m.product_id
            AND r.is_active = true
        )
    ) AS source
    GROUP BY source.product_id, source.warehouse_id
  LOOP
    quantity_to_add := COALESCE(consumption_record.quantity, 0);

    IF quantity_to_add <= 0 THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(
      consumption_record.warehouse_id,
      property_data.default_stock_warehouse_id,
      (
        SELECT w.id
        FROM public.stock_warehouses w
        WHERE w.sede_id = task_data.sede_id
          AND w.is_default = true
          AND w.is_active = true
        LIMIT 1
      )
    )
    INTO warehouse_id_resolved;

    IF NOT EXISTS (
      SELECT 1
      FROM public.stock_warehouses w
      WHERE w.id = warehouse_id_resolved
        AND w.sede_id = task_data.sede_id
        AND w.is_active = true
    ) THEN
      RAISE EXCEPTION 'No valid stock warehouse found for property %', property_id_param;
    END IF;

    INSERT INTO public.laundry_dirty_stock (product_id, warehouse_id, current_quantity, updated_by)
    VALUES (consumption_record.product_id, warehouse_id_resolved, 0, user_id_param)
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    SELECT *
    INTO dirty_record
    FROM public.laundry_dirty_stock
    WHERE product_id = consumption_record.product_id
      AND warehouse_id = warehouse_id_resolved
    FOR UPDATE;

    IF EXISTS (
      SELECT 1
      FROM public.laundry_dirty_movements dm
      WHERE dm.task_id = task_id_param
        AND dm.product_id = consumption_record.product_id
        AND dm.warehouse_id = warehouse_id_resolved
        AND dm.movement_type = 'entrada'
    ) THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    UPDATE public.laundry_dirty_stock
    SET current_quantity = current_quantity + quantity_to_add,
        updated_by = user_id_param
    WHERE id = dirty_record.id;

    INSERT INTO public.laundry_dirty_movements (
      product_id,
      warehouse_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      reason,
      task_id,
      property_id,
      created_by
    )
    VALUES (
      consumption_record.product_id,
      warehouse_id_resolved,
      'entrada',
      quantity_to_add,
      dirty_record.current_quantity,
      dirty_record.current_quantity + quantity_to_add,
      movement_reason,
      task_id_param,
      property_id_param,
      user_id_param
    );

    added_count := added_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'added', added_count,
    'skipped', skipped_count
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.process_laundry_dirty_for_task(UUID, UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.process_laundry_dirty_for_task(UUID, UUID, UUID)
TO authenticated, service_role;

COMMENT ON TABLE public.laundry_dirty_stock IS 'Current dirty laundry waiting to be sent to the laundry service.';
COMMENT ON TABLE public.laundry_dirty_movements IS 'Audit trail for dirty laundry additions, removals and adjustments.';
