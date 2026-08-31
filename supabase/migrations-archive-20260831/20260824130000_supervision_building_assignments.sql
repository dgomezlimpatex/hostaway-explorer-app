-- Supervisión 2.0: asignación real de supervisoras a edificios.
-- Los edificios siguen siendo property_groups; no se reutilizan las asignaciones de limpiadoras.

CREATE TABLE IF NOT EXISTS public.supervision_building_supervisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_group_id UUID NOT NULL REFERENCES public.property_groups(id) ON DELETE CASCADE,
  supervisor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL DEFAULT 'primary' CHECK (role_type IN ('primary', 'secondary', 'backup')),
  priority INTEGER NOT NULL DEFAULT 10 CHECK (priority > 0),
  starts_on DATE,
  ends_on DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
  UNIQUE (property_group_id, supervisor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_supervision_building_supervisors_user
  ON public.supervision_building_supervisors(supervisor_user_id, is_active, priority);
CREATE INDEX IF NOT EXISTS idx_supervision_building_supervisors_building
  ON public.supervision_building_supervisors(property_group_id, is_active, priority);

CREATE OR REPLACE FUNCTION public.supervision_building_has_sede_access(
  _property_group_id UUID,
  _user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.property_group_assignments pga
    JOIN public.properties p ON p.id = pga.property_id
    WHERE pga.property_group_id = _property_group_id
      AND NOT public.user_has_sede_access(_user_id, p.sede_id)
  )
  AND EXISTS (
    SELECT 1
    FROM public.property_group_assignments pga
    JOIN public.properties p ON p.id = pga.property_id
    WHERE pga.property_group_id = _property_group_id
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_supervision_building_supervisor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.supervisor_user_id
      AND role = 'supervisor'::public.app_role
  ) THEN
    RAISE EXCEPTION 'supervision assignee must have supervisor role';
  END IF;

  IF NOT public.supervision_building_has_sede_access(NEW.property_group_id, NEW.supervisor_user_id) THEN
    RAISE EXCEPTION 'supervisor does not have access to every property sede in building';
  END IF;

  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_supervision_building_supervisor
  ON public.supervision_building_supervisors;
CREATE TRIGGER trg_validate_supervision_building_supervisor
BEFORE INSERT OR UPDATE OF property_group_id, supervisor_user_id, role_type, priority, starts_on, ends_on, is_active
ON public.supervision_building_supervisors
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_building_supervisor();

ALTER TABLE public.supervision_building_supervisors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.supervision_building_supervisors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.supervision_building_supervisors TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.supervision_building_supervisors TO authenticated;

DROP POLICY IF EXISTS supervision_building_supervisors_select
  ON public.supervision_building_supervisors;
CREATE POLICY supervision_building_supervisors_select
ON public.supervision_building_supervisors
FOR SELECT TO authenticated
USING (
  public.user_is_admin_or_manager()
  OR (
    supervisor_user_id = auth.uid()
    AND is_active
    AND (starts_on IS NULL OR starts_on <= CURRENT_DATE)
    AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
  )
);

DROP POLICY IF EXISTS supervision_building_supervisors_insert
  ON public.supervision_building_supervisors;
CREATE POLICY supervision_building_supervisors_insert
ON public.supervision_building_supervisors
FOR INSERT TO authenticated
WITH CHECK (public.user_is_admin_or_manager());

DROP POLICY IF EXISTS supervision_building_supervisors_update
  ON public.supervision_building_supervisors;
CREATE POLICY supervision_building_supervisors_update
ON public.supervision_building_supervisors
FOR UPDATE TO authenticated
USING (public.user_is_admin_or_manager())
WITH CHECK (public.user_is_admin_or_manager());

DROP POLICY IF EXISTS supervision_building_supervisors_delete
  ON public.supervision_building_supervisors;
CREATE POLICY supervision_building_supervisors_delete
ON public.supervision_building_supervisors
FOR DELETE TO authenticated
USING (public.user_is_admin_or_manager());

REVOKE ALL ON FUNCTION public.supervision_building_has_sede_access(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supervision_building_has_sede_access(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.validate_supervision_building_supervisor() FROM PUBLIC, anon, authenticated;
