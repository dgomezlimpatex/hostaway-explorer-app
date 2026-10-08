-- Apply only with explicit production approval. No existing building is retired here.
ALTER TABLE public.property_groups
  ADD COLUMN retired_at timestamptz,
  ADD COLUMN retirement_snapshot jsonb;

-- Retired buildings are immutable historical records, not reusable empty groups.
CREATE FUNCTION public.protect_retired_property_group() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.retired_at IS NOT NULL THEN
    RAISE EXCEPTION 'El edificio está retirado y conserva su historial.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_retired_property_group
BEFORE UPDATE OR DELETE ON public.property_groups
FOR EACH ROW EXECUTE FUNCTION public.protect_retired_property_group();

-- Serialize new/edited links with retirement. A stale editor cannot reattach them.
CREATE FUNCTION public.check_property_group_not_retired() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE v_retired timestamptz;
BEGIN
  SELECT retired_at INTO v_retired FROM public.property_groups
    WHERE id = NEW.property_group_id FOR SHARE;
  IF NOT FOUND OR v_retired IS NOT NULL THEN
    RAISE EXCEPTION 'El edificio ya no está disponible para vincular personal o propiedades.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER check_property_group_not_retired
BEFORE INSERT OR UPDATE ON public.property_group_assignments
FOR EACH ROW EXECUTE FUNCTION public.check_property_group_not_retired();
CREATE TRIGGER check_property_group_not_retired
BEFORE INSERT OR UPDATE ON public.cleaner_group_assignments
FOR EACH ROW EXECUTE FUNCTION public.check_property_group_not_retired();

CREATE FUNCTION public.retire_property_group(p_group_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE v_group public.property_groups%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.user_is_admin_or_manager(), false) THEN
    RAISE EXCEPTION 'No tienes permiso para retirar edificios.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_group FROM public.property_groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El edificio no existe o no está disponible.'; END IF;
  IF v_group.retired_at IS NOT NULL THEN RETURN; END IF;

  -- DELETE ... RETURNING captures exactly the links removed, including concurrent
  -- deletions. Any failure rolls back both removals and the retirement together.
  WITH removed_properties AS (
    DELETE FROM public.property_group_assignments WHERE property_group_id = p_group_id RETURNING *
  ), removed_team AS (
    DELETE FROM public.cleaner_group_assignments WHERE property_group_id = p_group_id RETURNING *
  )
  UPDATE public.property_groups SET
    is_active = false,
    auto_assign_enabled = false,
    retired_at = statement_timestamp(),
    retirement_snapshot = jsonb_build_object(
      'retired_by', auth.uid(),
      'building', to_jsonb(v_group),
      'properties', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM removed_properties p), '[]'::jsonb),
      'team', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM removed_team t), '[]'::jsonb)
    )
  WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo retirar el edificio.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.retire_property_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retire_property_group(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.protect_retired_property_group() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_property_group_not_retired() FROM PUBLIC, anon;
