-- Integridad final del histórico de supervisión.
-- Los informes diarios son salidas del sistema y no se editan desde el cliente.
-- La autoría de una revisión/incidencia no cambia al editar su estado o contenido.

REVOKE INSERT, UPDATE, DELETE ON TABLE public.supervision_daily_reports FROM authenticated;
DROP POLICY IF EXISTS supervision_daily_reports_insert ON public.supervision_daily_reports;
DROP POLICY IF EXISTS supervision_daily_reports_update ON public.supervision_daily_reports;
DROP POLICY IF EXISTS supervision_daily_reports_delete ON public.supervision_daily_reports;

CREATE OR REPLACE FUNCTION public.preserve_supervision_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'supervision_reviews' THEN
    NEW.reviewer_user_id := OLD.reviewer_user_id;
  ELSIF TG_TABLE_NAME = 'supervision_incidents' THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supervision_reviews_audit_immutable ON public.supervision_reviews;
CREATE TRIGGER trg_supervision_reviews_audit_immutable
BEFORE UPDATE OF reviewer_user_id ON public.supervision_reviews
FOR EACH ROW EXECUTE FUNCTION public.preserve_supervision_audit_fields();

DROP TRIGGER IF EXISTS trg_supervision_incidents_audit_immutable ON public.supervision_incidents;
CREATE TRIGGER trg_supervision_incidents_audit_immutable
BEFORE UPDATE OF created_by ON public.supervision_incidents
FOR EACH ROW EXECUTE FUNCTION public.preserve_supervision_audit_fields();

REVOKE ALL ON FUNCTION public.preserve_supervision_audit_fields() FROM PUBLIC, anon, authenticated;
