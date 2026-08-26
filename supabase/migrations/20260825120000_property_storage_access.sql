-- Supervisión 2.0 · relación operativa apartamento–trastero.
-- El stock continúa siendo propiedad de la ubicación física (stock_warehouses),
-- nunca del apartamento. Esta tabla solo describe quién utiliza el trastero.

CREATE TABLE IF NOT EXISTS public.property_storage_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  property_group_id UUID NOT NULL REFERENCES public.property_groups(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.stock_warehouses(id) ON DELETE RESTRICT,
  access_type TEXT NOT NULL DEFAULT 'shared'
    CHECK (access_type IN ('shared', 'none')),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT property_storage_access_one_per_property UNIQUE (property_id),
  CONSTRAINT property_storage_access_type_consistency CHECK (
    (access_type = 'shared' AND warehouse_id IS NOT NULL)
    OR (access_type = 'none' AND warehouse_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS property_storage_access_group_idx
  ON public.property_storage_access(property_group_id, is_active);
CREATE INDEX IF NOT EXISTS property_storage_access_warehouse_idx
  ON public.property_storage_access(warehouse_id, is_active);

ALTER TABLE public.property_storage_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.property_storage_access FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.property_storage_access TO authenticated;

DROP POLICY IF EXISTS property_storage_access_select_scoped ON public.property_storage_access;
CREATE POLICY property_storage_access_select_scoped
ON public.property_storage_access FOR SELECT TO authenticated
USING (
  public.user_is_admin_or_manager()
  OR public.supervision_user_has_building_assignment(property_group_id, auth.uid(), CURRENT_DATE)
);

CREATE OR REPLACE FUNCTION public.set_property_storage_access(
  _property_id UUID,
  _property_group_id UUID,
  _access_type TEXT,
  _warehouse_id UUID DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS public.property_storage_access
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.property_storage_access;
BEGIN
  IF NOT public.user_is_admin_or_manager() THEN
    RAISE EXCEPTION 'property storage access requires administrator or manager';
  END IF;

  IF _access_type NOT IN ('shared', 'none') THEN
    RAISE EXCEPTION 'invalid property storage access type';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.property_group_assignments a
    WHERE a.property_group_id = _property_group_id
      AND a.property_id = _property_id
  ) THEN
    RAISE EXCEPTION 'property is not assigned to this building';
  END IF;

  IF _access_type = 'none' AND _warehouse_id IS NOT NULL THEN
    RAISE EXCEPTION 'property without storage access cannot have a warehouse';
  END IF;

  IF _access_type = 'shared' AND NOT EXISTS (
    SELECT 1
    FROM public.stock_warehouses w
    WHERE w.id = _warehouse_id
      AND w.property_group_id = _property_group_id
      AND w.location_type = 'building_storage'
      AND w.is_active = true
  ) THEN
    RAISE EXCEPTION 'shared property storage must use an active building warehouse';
  END IF;

  INSERT INTO public.property_storage_access (
    property_id,
    property_group_id,
    warehouse_id,
    access_type,
    notes,
    is_active,
    updated_at
  )
  VALUES (
    _property_id,
    _property_group_id,
    _warehouse_id,
    _access_type,
    NULLIF(trim(_notes), ''),
    true,
    now()
  )
  ON CONFLICT (property_id) DO UPDATE SET
    property_group_id = EXCLUDED.property_group_id,
    warehouse_id = EXCLUDED.warehouse_id,
    access_type = EXCLUDED.access_type,
    notes = EXCLUDED.notes,
    is_active = true,
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.set_property_storage_access(UUID, UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_property_storage_access(UUID, UUID, TEXT, UUID, TEXT) TO authenticated;

COMMENT ON TABLE public.property_storage_access IS
  'Operational access from an apartment to its building storage location. Stock is counted once per physical warehouse.';
COMMENT ON COLUMN public.property_storage_access.access_type IS
  'shared: apartment uses the building warehouse; none: apartment has no storage access.';
