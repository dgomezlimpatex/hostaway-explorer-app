-- Supervisión: permitir que una supervisora lea únicamente sus edificios asignados.
-- La causa del vacío era RLS: las tablas tenían datos, pero su SELECT solo estaba
-- permitido a admin/manager. No se conceden escrituras ni acceso a otros edificios.

GRANT SELECT ON TABLE public.property_groups TO authenticated;
GRANT SELECT ON TABLE public.property_group_assignments TO authenticated;

DROP POLICY IF EXISTS supervision_property_groups_select_assigned
  ON public.property_groups;
CREATE POLICY supervision_property_groups_select_assigned
ON public.property_groups
FOR SELECT TO authenticated
USING (
  public.user_is_admin_or_manager()
  OR (
    is_active
    AND EXISTS (
      SELECT 1
      FROM public.supervision_building_supervisors a
      WHERE a.property_group_id = property_groups.id
        AND a.supervisor_user_id = auth.uid()
        AND a.is_active
        AND (a.starts_on IS NULL OR a.starts_on <= CURRENT_DATE)
        AND (a.ends_on IS NULL OR a.ends_on >= CURRENT_DATE)
    )
  )
);

DROP POLICY IF EXISTS supervision_property_group_assignments_select_assigned
  ON public.property_group_assignments;
CREATE POLICY supervision_property_group_assignments_select_assigned
ON public.property_group_assignments
FOR SELECT TO authenticated
USING (
  public.user_is_admin_or_manager()
  OR EXISTS (
    SELECT 1
    FROM public.supervision_building_supervisors a
    WHERE a.property_group_id = property_group_assignments.property_group_id
      AND a.supervisor_user_id = auth.uid()
      AND a.is_active
      AND (a.starts_on IS NULL OR a.starts_on <= CURRENT_DATE)
      AND (a.ends_on IS NULL OR a.ends_on >= CURRENT_DATE)
  )
);
