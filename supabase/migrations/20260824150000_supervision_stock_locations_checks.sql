-- Supervisión 2.0 · Ola 3: ubicaciones físicas, inventarios y reposición.
-- Reutiliza stock_warehouses/stock_levels; no toca las tablas inventory_* legacy.

ALTER TABLE public.stock_warehouses
  ADD COLUMN IF NOT EXISTS property_group_id UUID REFERENCES public.property_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_type TEXT NOT NULL DEFAULT 'central';

ALTER TABLE public.stock_warehouses
  DROP CONSTRAINT IF EXISTS stock_warehouses_location_type_check;
ALTER TABLE public.stock_warehouses
  ADD CONSTRAINT stock_warehouses_location_type_check
  CHECK (location_type IN ('central', 'building_storage'));

CREATE UNIQUE INDEX IF NOT EXISTS stock_warehouses_one_active_building_storage
  ON public.stock_warehouses(property_group_id)
  WHERE property_group_id IS NOT NULL AND location_type = 'building_storage' AND is_active = true;
CREATE INDEX IF NOT EXISTS stock_warehouses_property_group_idx
  ON public.stock_warehouses(property_group_id, location_type, is_active);

CREATE TABLE IF NOT EXISTS public.supervision_stock_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES public.stock_warehouses(id) ON DELETE RESTRICT,
  property_group_id UUID REFERENCES public.property_groups(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  check_type TEXT NOT NULL DEFAULT 'inventory' CHECK (check_type IN ('restock', 'inventory')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'blocked', 'cancelled')),
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, scheduled_date, check_type)
);

CREATE TABLE IF NOT EXISTS public.supervision_stock_check_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES public.supervision_stock_checks(id) ON DELETE CASCADE,
  stock_level_id UUID NOT NULL REFERENCES public.stock_levels(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE RESTRICT,
  expected_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  observed_quantity NUMERIC(12,2),
  difference NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (check_id, stock_level_id),
  CHECK (expected_quantity >= 0),
  CHECK (observed_quantity IS NULL OR observed_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS supervision_stock_checks_building_date_idx
  ON public.supervision_stock_checks(property_group_id, scheduled_date, status);
CREATE INDEX IF NOT EXISTS supervision_stock_check_lines_check_idx
  ON public.supervision_stock_check_lines(check_id);

CREATE OR REPLACE FUNCTION public.supervision_stock_warehouse_can_access(_warehouse_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_is_admin_or_manager()
    OR EXISTS (
      SELECT 1
      FROM public.stock_warehouses w
      WHERE w.id = _warehouse_id
        AND w.location_type = 'building_storage'
        AND w.property_group_id IS NOT NULL
        AND public.supervision_user_has_building_assignment(w.property_group_id, auth.uid(), CURRENT_DATE)
    );
$$;

-- El supervisor no debe ver stock de todas las sedes/almacenes por tener el rol.
DROP POLICY IF EXISTS "stock_warehouses_supervisor_read" ON public.stock_warehouses;
CREATE POLICY stock_warehouses_supervisor_read_scoped
ON public.stock_warehouses FOR SELECT TO authenticated
USING (
  public.user_is_admin_or_manager()
  OR public.supervision_stock_warehouse_can_access(id)
);

DROP POLICY IF EXISTS "stock_levels_supervisor_read" ON public.stock_levels;
CREATE POLICY stock_levels_supervisor_read_scoped
ON public.stock_levels FOR SELECT TO authenticated
USING (
  public.user_is_admin_or_manager()
  OR public.supervision_stock_warehouse_can_access(warehouse_id)
);

DROP POLICY IF EXISTS "stock_products_supervisor_read" ON public.stock_products;
CREATE POLICY stock_products_supervisor_read_scoped
ON public.stock_products FOR SELECT TO authenticated
USING (
  public.user_is_admin_or_manager()
  OR EXISTS (
    SELECT 1 FROM public.stock_levels l
    WHERE l.product_id = stock_products.id
      AND public.supervision_stock_warehouse_can_access(l.warehouse_id)
  )
);

DROP POLICY IF EXISTS "stock_categories_supervisor_read" ON public.stock_categories;
CREATE POLICY stock_categories_supervisor_read_scoped
ON public.stock_categories FOR SELECT TO authenticated
USING (
  public.user_is_admin_or_manager()
  OR EXISTS (
    SELECT 1 FROM public.stock_products p
    JOIN public.stock_levels l ON l.product_id = p.id
    WHERE p.category_id = stock_categories.id
      AND public.supervision_stock_warehouse_can_access(l.warehouse_id)
  )
);

ALTER TABLE public.supervision_stock_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_stock_check_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.supervision_stock_checks, public.supervision_stock_check_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.supervision_stock_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.supervision_stock_check_lines TO authenticated;

CREATE POLICY supervision_stock_checks_select
ON public.supervision_stock_checks FOR SELECT TO authenticated
USING (public.supervision_stock_warehouse_can_access(warehouse_id));
CREATE POLICY supervision_stock_checks_insert
ON public.supervision_stock_checks FOR INSERT TO authenticated
WITH CHECK (public.supervision_stock_warehouse_can_access(warehouse_id));
CREATE POLICY supervision_stock_checks_update
ON public.supervision_stock_checks FOR UPDATE TO authenticated
USING (public.supervision_stock_warehouse_can_access(warehouse_id))
WITH CHECK (public.supervision_stock_warehouse_can_access(warehouse_id));

CREATE POLICY supervision_stock_check_lines_select
ON public.supervision_stock_check_lines FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_stock_checks c WHERE c.id = check_id AND public.supervision_stock_warehouse_can_access(c.warehouse_id)));
CREATE POLICY supervision_stock_check_lines_insert
ON public.supervision_stock_check_lines FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_stock_checks c WHERE c.id = check_id AND public.supervision_stock_warehouse_can_access(c.warehouse_id)));
CREATE POLICY supervision_stock_check_lines_update
ON public.supervision_stock_check_lines FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_stock_checks c WHERE c.id = check_id AND public.supervision_stock_warehouse_can_access(c.warehouse_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_stock_checks c WHERE c.id = check_id AND public.supervision_stock_warehouse_can_access(c.warehouse_id)));

CREATE OR REPLACE FUNCTION public.begin_supervision_stock_check(
  _warehouse_id UUID,
  _property_group_id UUID,
  _scheduled_date DATE,
  _check_type TEXT DEFAULT 'inventory'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  check_id UUID;
BEGIN
  IF NOT public.supervision_stock_warehouse_can_access(_warehouse_id) THEN
    RAISE EXCEPTION 'stock warehouse access denied';
  END IF;
  IF _check_type NOT IN ('restock', 'inventory') THEN RAISE EXCEPTION 'invalid stock check type'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.stock_warehouses w
    WHERE w.id = _warehouse_id
      AND w.property_group_id IS NOT DISTINCT FROM _property_group_id
  ) THEN RAISE EXCEPTION 'warehouse and building do not match'; END IF;

  INSERT INTO public.supervision_stock_checks (warehouse_id, property_group_id, scheduled_date, check_type, status, checked_by, started_at)
  VALUES (_warehouse_id, _property_group_id, _scheduled_date, _check_type, 'in_progress', auth.uid(), now())
  ON CONFLICT (warehouse_id, scheduled_date, check_type) DO UPDATE SET
    status = CASE WHEN supervision_stock_checks.status = 'completed' THEN 'completed' ELSE 'in_progress' END,
    checked_by = COALESCE(supervision_stock_checks.checked_by, auth.uid()),
    started_at = COALESCE(supervision_stock_checks.started_at, now()),
    updated_at = now()
  RETURNING id INTO check_id;

  IF check_id IS NULL THEN
    SELECT id INTO check_id FROM public.supervision_stock_checks
    WHERE warehouse_id = _warehouse_id AND scheduled_date = _scheduled_date AND check_type = _check_type;
  END IF;

  INSERT INTO public.supervision_stock_check_lines (check_id, stock_level_id, product_id, expected_quantity, observed_quantity, difference)
  SELECT check_id, l.id, l.product_id, l.target_quantity, l.current_quantity, 0
  FROM public.stock_levels l
  WHERE l.warehouse_id = _warehouse_id
  ON CONFLICT (check_id, stock_level_id) DO NOTHING;
  RETURN check_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_supervision_stock_check(
  _check_id UUID,
  _notes TEXT DEFAULT NULL
)
RETURNS public.supervision_stock_checks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_check public.supervision_stock_checks;
  line RECORD;
  result_check public.supervision_stock_checks;
  delta NUMERIC(12,2);
BEGIN
  SELECT * INTO current_check FROM public.supervision_stock_checks WHERE id = _check_id FOR UPDATE;
  IF current_check.id IS NULL THEN RAISE EXCEPTION 'stock check not found'; END IF;
  IF NOT public.supervision_stock_warehouse_can_access(current_check.warehouse_id) THEN RAISE EXCEPTION 'stock warehouse access denied'; END IF;
  IF current_check.status = 'completed' THEN RETURN current_check; END IF;

  FOR line IN SELECT * FROM public.supervision_stock_check_lines WHERE check_id = _check_id FOR UPDATE LOOP
    IF line.observed_quantity IS NULL THEN RAISE EXCEPTION 'all stock lines require an observed quantity'; END IF;
    delta := line.observed_quantity - line.expected_quantity;
    UPDATE public.supervision_stock_check_lines
    SET difference = delta, updated_at = now()
    WHERE id = line.id;

    IF delta <> 0 THEN
      UPDATE public.stock_levels
      SET current_quantity = line.observed_quantity, updated_by = auth.uid()
      WHERE id = line.stock_level_id;
      INSERT INTO public.stock_movements (
        product_id, warehouse_id, movement_type, quantity, previous_quantity, new_quantity, reason, created_by
      )
      SELECT l.product_id, l.warehouse_id, 'ajuste'::public.stock_movement_type,
        abs(delta), l.current_quantity, line.observed_quantity,
        'Recuento de supervisión ' || current_check.id::text, auth.uid()
      FROM public.stock_levels l WHERE l.id = line.stock_level_id;
    END IF;
  END LOOP;

  UPDATE public.supervision_stock_checks
  SET status = 'completed', notes = COALESCE(_notes, notes), completed_at = now(), updated_at = now()
  WHERE id = _check_id
  RETURNING * INTO result_check;
  RETURN result_check;
END;
$$;

REVOKE ALL ON FUNCTION public.supervision_stock_warehouse_can_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supervision_stock_warehouse_can_access(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.begin_supervision_stock_check(UUID, UUID, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_supervision_stock_check(UUID, UUID, DATE, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.complete_supervision_stock_check(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_supervision_stock_check(UUID, TEXT) TO authenticated;
