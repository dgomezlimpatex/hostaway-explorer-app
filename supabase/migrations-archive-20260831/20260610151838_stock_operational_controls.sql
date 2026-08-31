-- Operational controls for the professional stock module.
-- Automatic consumption remains disabled by default until each sede is validated.

CREATE TABLE IF NOT EXISTS public.stock_sede_settings (
  sede_id UUID PRIMARY KEY REFERENCES public.sedes(id) ON DELETE CASCADE,
  auto_consumption_enabled BOOLEAN NOT NULL DEFAULT false,
  preparation_mode BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_stock_sede_settings_updated_at ON public.stock_sede_settings;

CREATE TRIGGER update_stock_sede_settings_updated_at
BEFORE UPDATE ON public.stock_sede_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.stock_sede_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.stock_sede_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_sede_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_sede_settings TO authenticated;

DROP POLICY IF EXISTS "stock_sede_settings_admin_manager_all" ON public.stock_sede_settings;
DROP POLICY IF EXISTS "stock_sede_settings_supervisor_read" ON public.stock_sede_settings;

CREATE POLICY "stock_sede_settings_admin_manager_all"
ON public.stock_sede_settings
FOR ALL TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
)
WITH CHECK (
  (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  OR (SELECT public.has_role(auth.uid(), 'manager'::public.app_role))
);

CREATE POLICY "stock_sede_settings_supervisor_read"
ON public.stock_sede_settings
FOR SELECT TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'supervisor'::public.app_role)));

INSERT INTO public.stock_sede_settings (sede_id)
SELECT s.id
FROM public.sedes s
ON CONFLICT (sede_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_stock_level_settings(
  stock_level_id_param UUID,
  minimum_quantity_param NUMERIC,
  target_quantity_param NUMERIC,
  cost_per_unit_param NUMERIC,
  user_id_param UUID
)
RETURNS public.stock_levels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  updated_level public.stock_levels;
BEGIN
  IF stock_level_id_param IS NULL OR user_id_param IS NULL THEN
    RAISE EXCEPTION 'stock_level_id and user_id are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_id_param
      AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'User not allowed to update stock settings';
  END IF;

  IF COALESCE(minimum_quantity_param, 0) < 0
    OR COALESCE(target_quantity_param, 0) < 0
    OR (cost_per_unit_param IS NOT NULL AND cost_per_unit_param < 0)
  THEN
    RAISE EXCEPTION 'Quantities and cost must be non-negative';
  END IF;

  IF COALESCE(target_quantity_param, 0) < COALESCE(minimum_quantity_param, 0) THEN
    RAISE EXCEPTION 'Target quantity must be greater than or equal to minimum quantity';
  END IF;

  UPDATE public.stock_levels
  SET
    minimum_quantity = COALESCE(minimum_quantity_param, 0),
    target_quantity = COALESCE(target_quantity_param, 0),
    cost_per_unit = cost_per_unit_param,
    updated_by = user_id_param
  WHERE id = stock_level_id_param
  RETURNING * INTO updated_level;

  IF updated_level.id IS NULL THEN
    RAISE EXCEPTION 'Stock level not found';
  END IF;

  RETURN updated_level;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_stock_level_settings(UUID, NUMERIC, NUMERIC, NUMERIC, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.process_stock_consumption_for_task(
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
  sede_settings RECORD;
  consumption_record RECORD;
  stock_record RECORD;
  warehouse_id_resolved UUID;
  movement_reason TEXT;
  quantity_to_consume NUMERIC(12, 2);
  consumed_count INTEGER := 0;
  skipped_count INTEGER := 0;
  alert_count INTEGER := 0;
BEGIN
  IF task_id_param IS NULL OR property_id_param IS NULL OR user_id_param IS NULL THEN
    RAISE EXCEPTION 'task_id, property_id and user_id are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_id_param
      AND role IN ('admin', 'manager', 'supervisor', 'cleaner')
  ) THEN
    RAISE EXCEPTION 'User not allowed to process stock consumption';
  END IF;

  SELECT * INTO property_data
  FROM public.properties
  WHERE id = property_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  SELECT * INTO sede_settings
  FROM public.stock_sede_settings
  WHERE sede_id = property_data.sede_id;

  IF COALESCE(sede_settings.auto_consumption_enabled, false) = false
    OR COALESCE(sede_settings.preparation_mode, true) = true
  THEN
    RETURN jsonb_build_object(
      'disabled', true,
      'reason', 'stock_auto_consumption_disabled',
      'consumed', 0,
      'skipped', 0,
      'alerts', 0
    );
  END IF;

  movement_reason := 'Consumo automatico por tarea completada en ' || COALESCE(property_data.nombre, property_data.codigo, property_id_param::TEXT);

  FOR consumption_record IN
    SELECT
      r.product_id,
      r.warehouse_id,
      r.quantity_per_cleaning AS quantity
    FROM public.stock_property_consumption_rules r
    JOIN public.stock_products p ON p.id = r.product_id
    WHERE r.property_id = property_id_param
      AND r.is_active = true
      AND p.sede_id = property_data.sede_id
      AND p.is_active = true
      AND p.is_consumable = true

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
          WHEN 'amenities_bano' THEN COALESCE(property_data.amenities_bano, 0)
          WHEN 'amenities_cocina' THEN COALESCE(property_data.amenities_cocina, 0)
          WHEN 'cantidad_rollos_papel_higienico' THEN COALESCE(property_data.cantidad_rollos_papel_higienico, 0)
          WHEN 'cantidad_rollos_papel_cocina' THEN COALESCE(property_data.cantidad_rollos_papel_cocina, 0)
          WHEN 'kit_alimentario' THEN COALESCE(property_data.kit_alimentario, 0)
          WHEN 'bayetas_cocina' THEN COALESCE(property_data.bayetas_cocina, 0)
          WHEN 'bolsas_basura' THEN COALESCE(property_data.bolsas_basura, 0)
          ELSE 0
        END
      )::NUMERIC(12, 2) * m.multiplier AS quantity
    FROM public.stock_property_field_mappings m
    JOIN public.stock_products p ON p.id = m.product_id
    WHERE m.sede_id = property_data.sede_id
      AND m.is_active = true
      AND p.is_active = true
      AND p.is_consumable = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.stock_property_consumption_rules r
        WHERE r.property_id = property_id_param
          AND r.product_id = m.product_id
          AND r.is_active = true
      )
  LOOP
    quantity_to_consume := COALESCE(consumption_record.quantity, 0);

    IF quantity_to_consume <= 0 THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(
      consumption_record.warehouse_id,
      property_data.default_stock_warehouse_id,
      (
        SELECT w.id
        FROM public.stock_warehouses w
        WHERE w.sede_id = property_data.sede_id
          AND w.is_default = true
          AND w.is_active = true
        LIMIT 1
      )
    )
    INTO warehouse_id_resolved;

    IF warehouse_id_resolved IS NULL THEN
      RAISE EXCEPTION 'No default stock warehouse found for property %', property_id_param;
    END IF;

    INSERT INTO public.stock_levels (product_id, warehouse_id, current_quantity, minimum_quantity, target_quantity, updated_by)
    VALUES (consumption_record.product_id, warehouse_id_resolved, 0, 0, 0, user_id_param)
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    SELECT * INTO stock_record
    FROM public.stock_levels
    WHERE product_id = consumption_record.product_id
      AND warehouse_id = warehouse_id_resolved
    FOR UPDATE;

    IF EXISTS (
      SELECT 1
      FROM public.stock_movements sm
      WHERE sm.task_id = task_id_param
        AND sm.product_id = consumption_record.product_id
        AND sm.warehouse_id = warehouse_id_resolved
        AND sm.movement_type = 'consumo_automatico'
    ) THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    IF stock_record.current_quantity < quantity_to_consume THEN
      PERFORM public.create_stock_alert_if_needed(
        stock_record.id,
        consumption_record.product_id,
        warehouse_id_resolved,
        'stock_critico'
      );
      alert_count := alert_count + 1;
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    UPDATE public.stock_levels
    SET
      current_quantity = current_quantity - quantity_to_consume,
      updated_by = user_id_param
    WHERE id = stock_record.id;

    INSERT INTO public.stock_movements (
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
      'consumo_automatico',
      quantity_to_consume,
      stock_record.current_quantity,
      stock_record.current_quantity - quantity_to_consume,
      movement_reason,
      task_id_param,
      property_id_param,
      user_id_param
    );

    consumed_count := consumed_count + 1;

    IF stock_record.current_quantity - quantity_to_consume <= stock_record.minimum_quantity THEN
      PERFORM public.create_stock_alert_if_needed(
        stock_record.id,
        consumption_record.product_id,
        warehouse_id_resolved,
        CASE
          WHEN stock_record.current_quantity - quantity_to_consume = 0 THEN 'stock_critico'::public.stock_alert_type
          ELSE 'stock_bajo'::public.stock_alert_type
        END
      );
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'disabled', false,
    'consumed', consumed_count,
    'skipped', skipped_count,
    'alerts', alert_count
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.process_stock_consumption_for_task(UUID, UUID, UUID) TO authenticated, service_role;

COMMENT ON TABLE public.stock_sede_settings IS 'Operational switches for stock rollout by sede.';
