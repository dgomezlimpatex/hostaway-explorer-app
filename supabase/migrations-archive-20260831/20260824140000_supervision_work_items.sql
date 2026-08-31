-- Supervisión 2.0 · Ola 2: políticas de frecuencia y trabajo durable.
-- Cambio aditivo: no elimina rutas, revisiones ni incidencias existentes.

CREATE TABLE IF NOT EXISTS public.supervision_building_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_group_id UUID NOT NULL UNIQUE REFERENCES public.property_groups(id) ON DELETE CASCADE,
  quick_review_every_days INTEGER NOT NULL DEFAULT 1 CHECK (quick_review_every_days BETWEEN 1 AND 31),
  full_review_every_days INTEGER NOT NULL DEFAULT 7 CHECK (full_review_every_days BETWEEN 1 AND 90),
  full_review_requires_cleaning BOOLEAN NOT NULL DEFAULT false,
  review_open_incidents BOOLEAN NOT NULL DEFAULT true,
  review_returned_work BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.supervision_building_policies (property_group_id)
SELECT id FROM public.property_groups
ON CONFLICT (property_group_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.supervision_work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_key TEXT NOT NULL UNIQUE,
  property_group_id UUID NOT NULL REFERENCES public.property_groups(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  review_id UUID REFERENCES public.supervision_reviews(id) ON DELETE SET NULL,
  incident_id UUID REFERENCES public.supervision_incidents(id) ON DELETE SET NULL,
  assigned_supervisor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  work_type TEXT NOT NULL CHECK (work_type IN (
    'apartment_quick', 'apartment_full', 'rework', 'incident',
    'storage_restock', 'storage_inventory', 'equipment',
    'common_area', 'warehouse_inventory', 'extraordinary'
  )),
  scheduled_date DATE NOT NULL,
  due_at TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'deferred', 'blocked', 'cancelled')),
  defer_reason TEXT,
  blocked_reason TEXT,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'deferred' OR NULLIF(trim(defer_reason), '') IS NOT NULL),
  CHECK (status <> 'blocked' OR NULLIF(trim(blocked_reason), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_supervision_work_items_building_date
  ON public.supervision_work_items(property_group_id, scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_supervision_work_items_supervisor_date
  ON public.supervision_work_items(assigned_supervisor_user_id, scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_supervision_work_items_property_date
  ON public.supervision_work_items(property_id, scheduled_date, work_type);

CREATE OR REPLACE FUNCTION public.supervision_user_has_building_assignment(
  _property_group_id UUID,
  _user_id UUID,
  _date DATE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.supervision_building_supervisors a
    WHERE a.property_group_id = _property_group_id
      AND a.supervisor_user_id = _user_id
      AND a.is_active
      AND (a.starts_on IS NULL OR a.starts_on <= _date)
      AND (a.ends_on IS NULL OR a.ends_on >= _date)
  );
$$;

CREATE OR REPLACE FUNCTION public.supervision_work_item_can_access(
  _property_group_id UUID,
  _date DATE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_is_admin_or_manager()
    OR public.supervision_user_has_building_assignment(_property_group_id, auth.uid(), _date);
$$;

ALTER TABLE public.supervision_building_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.supervision_building_policies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.supervision_building_policies TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.supervision_building_policies TO authenticated;

DROP POLICY IF EXISTS supervision_building_policies_select ON public.supervision_building_policies;
CREATE POLICY supervision_building_policies_select
ON public.supervision_building_policies FOR SELECT TO authenticated
USING (
  public.user_is_admin_or_manager()
  OR public.supervision_user_has_building_assignment(property_group_id, auth.uid(), CURRENT_DATE)
);

DROP POLICY IF EXISTS supervision_building_policies_write ON public.supervision_building_policies;
CREATE POLICY supervision_building_policies_write
ON public.supervision_building_policies FOR ALL TO authenticated
USING (public.user_is_admin_or_manager())
WITH CHECK (public.user_is_admin_or_manager());

ALTER TABLE public.supervision_work_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.supervision_work_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.supervision_work_items TO authenticated;

DROP POLICY IF EXISTS supervision_work_items_select ON public.supervision_work_items;
CREATE POLICY supervision_work_items_select
ON public.supervision_work_items FOR SELECT TO authenticated
USING (public.supervision_work_item_can_access(property_group_id, scheduled_date));

CREATE OR REPLACE FUNCTION public.upsert_supervision_work_items(_items JSONB)
RETURNS SETOF public.supervision_work_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  saved public.supervision_work_items;
  item_group UUID;
  item_date DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF jsonb_typeof(_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'work items payload must be an array';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    item_group := (item->>'property_group_id')::UUID;
    item_date := (item->>'scheduled_date')::DATE;
    IF NOT public.supervision_work_item_can_access(item_group, item_date) THEN
      RAISE EXCEPTION 'supervision building assignment required';
    END IF;

    INSERT INTO public.supervision_work_items (
      generation_key, property_group_id, property_id, task_id, review_id, incident_id,
      assigned_supervisor_user_id, work_type, scheduled_date, due_at, priority, reasons, status,
      defer_reason, blocked_reason, completed_at
    ) VALUES (
      item->>'generation_key', item_group,
      NULLIF(item->>'property_id', '')::UUID,
      NULLIF(item->>'task_id', '')::UUID,
      NULLIF(item->>'review_id', '')::UUID,
      NULLIF(item->>'incident_id', '')::UUID,
      NULLIF(item->>'assigned_supervisor_user_id', '')::UUID,
      item->>'work_type', item_date,
      NULLIF(item->>'due_at', '')::TIMESTAMPTZ,
      COALESCE((item->>'priority')::INTEGER, 0),
      COALESCE(item->'reasons', '[]'::JSONB),
      COALESCE(item->>'status', 'pending'),
      NULLIF(item->>'defer_reason', ''), NULLIF(item->>'blocked_reason', ''),
      CASE WHEN item->>'status' = 'completed' THEN now() ELSE NULL END
    )
    ON CONFLICT (generation_key) DO UPDATE SET
      property_group_id = EXCLUDED.property_group_id,
      property_id = EXCLUDED.property_id,
      task_id = EXCLUDED.task_id,
      review_id = EXCLUDED.review_id,
      incident_id = EXCLUDED.incident_id,
      assigned_supervisor_user_id = EXCLUDED.assigned_supervisor_user_id,
      work_type = EXCLUDED.work_type,
      scheduled_date = EXCLUDED.scheduled_date,
      due_at = EXCLUDED.due_at,
      priority = EXCLUDED.priority,
      reasons = EXCLUDED.reasons,
      updated_at = now()
    RETURNING * INTO saved;
    RETURN NEXT saved;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_supervision_work_item_status(
  _work_item_id UUID,
  _status TEXT,
  _reason TEXT DEFAULT NULL
)
RETURNS public.supervision_work_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_item public.supervision_work_items;
  updated_item public.supervision_work_items;
BEGIN
  SELECT * INTO current_item
  FROM public.supervision_work_items
  WHERE id = _work_item_id
  FOR UPDATE;
  IF current_item.id IS NULL THEN RAISE EXCEPTION 'work item not found'; END IF;
  IF NOT public.supervision_work_item_can_access(current_item.property_group_id, current_item.scheduled_date) THEN
    RAISE EXCEPTION 'supervision building assignment required';
  END IF;
  IF _status NOT IN ('pending', 'in_progress', 'completed', 'deferred', 'blocked', 'cancelled') THEN
    RAISE EXCEPTION 'invalid work item status';
  END IF;
  IF _status = 'cancelled' AND NOT public.user_is_admin_or_manager() THEN
    RAISE EXCEPTION 'only admin or manager can cancel work items';
  END IF;
  IF _status IN ('deferred', 'blocked') AND NULLIF(trim(_reason), '') IS NULL THEN
    RAISE EXCEPTION 'reason required for deferred or blocked work item';
  END IF;

  UPDATE public.supervision_work_items
  SET status = _status,
      defer_reason = CASE WHEN _status = 'deferred' THEN NULLIF(trim(_reason), '') ELSE NULL END,
      blocked_reason = CASE WHEN _status = 'blocked' THEN NULLIF(trim(_reason), '') ELSE NULL END,
      completed_by = CASE WHEN _status = 'completed' THEN auth.uid() ELSE NULL END,
      completed_at = CASE WHEN _status = 'completed' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = _work_item_id
  RETURNING * INTO updated_item;
  RETURN updated_item;
END;
$$;

REVOKE ALL ON FUNCTION public.supervision_user_has_building_assignment(UUID, UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supervision_user_has_building_assignment(UUID, UUID, DATE) TO authenticated;
REVOKE ALL ON FUNCTION public.supervision_work_item_can_access(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supervision_work_item_can_access(UUID, DATE) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_supervision_work_items(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_supervision_work_items(JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.update_supervision_work_item_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_supervision_work_item_status(UUID, TEXT, TEXT) TO authenticated;
