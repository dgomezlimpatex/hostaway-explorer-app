
-- 1. Toggle por cliente
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS allow_incidents boolean NOT NULL DEFAULT false;

-- 2. Catálogo de categorías
CREATE TABLE IF NOT EXISTS public.incident_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.incident_categories (slug, label, sort_order) VALUES
  ('roturas',         'Roturas',          10),
  ('material-faltante','Material faltante', 20),
  ('averia',          'Avería',           30),
  ('otros',           'Otros',            99)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.incident_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Incident categories readable by all" ON public.incident_categories;
CREATE POLICY "Incident categories readable by all"
  ON public.incident_categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage incident categories" ON public.incident_categories;
CREATE POLICY "Admins manage incident categories"
  ON public.incident_categories FOR ALL
  USING (public.user_has_role('admin'::app_role))
  WITH CHECK (public.user_has_role('admin'::app_role));

-- 3. Enums
DO $$ BEGIN
  CREATE TYPE public.incident_status AS ENUM (
    'pending_limpatex','discarded_limpatex','open','in_progress','resolved','discarded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.incident_visibility AS ENUM ('public','internal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Tabla principal
CREATE TABLE IF NOT EXISTS public.cleaning_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  reporter_cleaner_id uuid REFERENCES public.cleaners(id) ON DELETE SET NULL,
  reporter_user_id uuid,
  reporter_kind text NOT NULL CHECK (reporter_kind IN ('cleaner','limpatex_admin')),
  category_id uuid REFERENCES public.incident_categories(id) ON DELETE SET NULL,
  location text,
  description text NOT NULL,
  status public.incident_status NOT NULL DEFAULT 'pending_limpatex',
  visibility public.incident_visibility NOT NULL DEFAULT 'public',
  approved_at timestamptz,
  approved_by uuid,
  discarded_by_limpatex_at timestamptz,
  discarded_by_limpatex_by uuid,
  discard_limpatex_reason text,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  client_discard_reason text,
  migrated_from_report_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cleaning_incidents_client ON public.cleaning_incidents(client_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_incidents_property ON public.cleaning_incidents(property_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_incidents_task ON public.cleaning_incidents(task_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_incidents_status ON public.cleaning_incidents(status);
CREATE INDEX IF NOT EXISTS idx_cleaning_incidents_sede ON public.cleaning_incidents(sede_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_incidents_created ON public.cleaning_incidents(created_at DESC);

DROP TRIGGER IF EXISTS trg_cleaning_incidents_updated_at ON public.cleaning_incidents;
CREATE TRIGGER trg_cleaning_incidents_updated_at
  BEFORE UPDATE ON public.cleaning_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_incident_categories_updated_at ON public.incident_categories;
CREATE TRIGGER trg_incident_categories_updated_at
  BEFORE UPDATE ON public.incident_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Adjuntos
CREATE TABLE IF NOT EXISTS public.cleaning_incident_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.cleaning_incidents(id) ON DELETE CASCADE,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo','video','document')),
  uploaded_by uuid,
  uploaded_by_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cleaning_incident_media_incident ON public.cleaning_incident_media(incident_id);

-- 6. Eventos
CREATE TABLE IF NOT EXISTS public.cleaning_incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.cleaning_incidents(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'created','approved','discarded_limpatex','status_change',
    'visibility_change','media_added','responsible_changed','deleted'
  )),
  from_status public.incident_status,
  to_status public.incident_status,
  note text,
  actor_user_id uuid,
  actor_name text,
  actor_role text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cleaning_incident_events_incident ON public.cleaning_incident_events(incident_id, created_at DESC);

-- RLS
ALTER TABLE public.cleaning_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_incident_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_incident_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read incidents in accessible sede" ON public.cleaning_incidents;
CREATE POLICY "Staff read incidents in accessible sede"
  ON public.cleaning_incidents FOR SELECT
  USING (public.user_has_role('admin'::app_role) OR public.user_can_access_task(sede_id));

DROP POLICY IF EXISTS "Admins and managers insert incidents" ON public.cleaning_incidents;
CREATE POLICY "Admins and managers insert incidents"
  ON public.cleaning_incidents FOR INSERT
  WITH CHECK (public.user_is_admin_or_manager());

DROP POLICY IF EXISTS "Cleaners insert own incidents" ON public.cleaning_incidents;
CREATE POLICY "Cleaners insert own incidents"
  ON public.cleaning_incidents FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.cleaners c WHERE c.user_id = auth.uid() AND c.id = reporter_cleaner_id)
  );

DROP POLICY IF EXISTS "Staff update incidents" ON public.cleaning_incidents;
CREATE POLICY "Staff update incidents"
  ON public.cleaning_incidents FOR UPDATE
  USING (
    public.user_is_admin_or_manager()
    OR (status = 'pending_limpatex'
        AND EXISTS (SELECT 1 FROM public.cleaners c WHERE c.user_id = auth.uid() AND c.id = reporter_cleaner_id))
  )
  WITH CHECK (
    public.user_is_admin_or_manager()
    OR EXISTS (SELECT 1 FROM public.cleaners c WHERE c.user_id = auth.uid() AND c.id = reporter_cleaner_id)
  );

DROP POLICY IF EXISTS "Admins delete incidents" ON public.cleaning_incidents;
CREATE POLICY "Admins delete incidents"
  ON public.cleaning_incidents FOR DELETE
  USING (public.user_has_role('admin'::app_role));

DROP POLICY IF EXISTS "Staff read incident media" ON public.cleaning_incident_media;
CREATE POLICY "Staff read incident media"
  ON public.cleaning_incident_media FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.cleaning_incidents i
            WHERE i.id = incident_id
              AND (public.user_has_role('admin'::app_role) OR public.user_can_access_task(i.sede_id)))
  );

DROP POLICY IF EXISTS "Staff insert incident media" ON public.cleaning_incident_media;
CREATE POLICY "Staff insert incident media"
  ON public.cleaning_incident_media FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.cleaning_incidents i
            WHERE i.id = incident_id
              AND (
                public.user_is_admin_or_manager()
                OR (i.status = 'pending_limpatex' AND EXISTS (
                  SELECT 1 FROM public.cleaners c WHERE c.user_id = auth.uid() AND c.id = i.reporter_cleaner_id))
              ))
  );

DROP POLICY IF EXISTS "Admins delete incident media" ON public.cleaning_incident_media;
CREATE POLICY "Admins delete incident media"
  ON public.cleaning_incident_media FOR DELETE
  USING (public.user_has_role('admin'::app_role));

DROP POLICY IF EXISTS "Staff read incident events" ON public.cleaning_incident_events;
CREATE POLICY "Staff read incident events"
  ON public.cleaning_incident_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.cleaning_incidents i
            WHERE i.id = incident_id
              AND (public.user_has_role('admin'::app_role) OR public.user_can_access_task(i.sede_id)))
  );

DROP POLICY IF EXISTS "Staff insert incident events" ON public.cleaning_incident_events;
CREATE POLICY "Staff insert incident events"
  ON public.cleaning_incident_events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.cleaning_incidents i
            WHERE i.id = incident_id
              AND (public.user_has_role('admin'::app_role) OR public.user_can_access_task(i.sede_id)))
  );

-- Migración desde issues_found
DO $mig$
DECLARE
  v_cat_other uuid;
  v_cat_break uuid;
  v_cat_missing uuid;
  v_cat_breakdown uuid;
  v_record record;
  v_issue jsonb;
  v_cat uuid;
  v_incident_id uuid;
  v_url text;
BEGIN
  -- Skip si ya migrado
  IF EXISTS (SELECT 1 FROM public.cleaning_incidents WHERE migrated_from_report_id IS NOT NULL LIMIT 1) THEN
    RETURN;
  END IF;

  SELECT id INTO v_cat_other     FROM public.incident_categories WHERE slug='otros';
  SELECT id INTO v_cat_break     FROM public.incident_categories WHERE slug='roturas';
  SELECT id INTO v_cat_missing   FROM public.incident_categories WHERE slug='material-faltante';
  SELECT id INTO v_cat_breakdown FROM public.incident_categories WHERE slug='averia';

  FOR v_record IN
    SELECT tr.id AS report_id, tr.task_id, tr.cleaner_id, tr.issues_found, tr.created_at,
           t.cliente_id, t.propiedad_id, t.sede_id
    FROM public.task_reports tr
    JOIN public.tasks t ON t.id = tr.task_id
    WHERE tr.issues_found IS NOT NULL
      AND jsonb_typeof(tr.issues_found) = 'array'
      AND jsonb_array_length(tr.issues_found) > 0
      AND t.cliente_id IS NOT NULL
      AND t.sede_id IS NOT NULL
  LOOP
    FOR v_issue IN SELECT * FROM jsonb_array_elements(v_record.issues_found)
    LOOP
      v_cat := CASE v_issue->>'type'
        WHEN 'damage'  THEN v_cat_break
        WHEN 'missing' THEN v_cat_missing
        WHEN 'maintenance' THEN v_cat_breakdown
        ELSE v_cat_other
      END;

      INSERT INTO public.cleaning_incidents (
        task_id, property_id, client_id, sede_id,
        reporter_cleaner_id, reporter_kind,
        category_id, description, status, visibility,
        approved_at, migrated_from_report_id, created_at, updated_at
      ) VALUES (
        v_record.task_id, v_record.propiedad_id, v_record.cliente_id, v_record.sede_id,
        v_record.cleaner_id, 'cleaner',
        v_cat, COALESCE(NULLIF(trim(v_issue->>'description'),''), '(sin descripción)'),
        'open', 'public',
        v_record.created_at, v_record.report_id, v_record.created_at, v_record.created_at
      )
      RETURNING id INTO v_incident_id;

      IF v_issue ? 'media_urls' AND jsonb_typeof(v_issue->'media_urls')='array' THEN
        FOR v_url IN SELECT jsonb_array_elements_text(v_issue->'media_urls')
        LOOP
          INSERT INTO public.cleaning_incident_media (incident_id, url, kind, created_at)
          VALUES (v_incident_id, v_url, 'photo', v_record.created_at);
        END LOOP;
      END IF;

      INSERT INTO public.cleaning_incident_events (incident_id, event_type, to_status, note, actor_role, created_at)
      VALUES (v_incident_id, 'created', 'open', 'Migrada desde issues_found', 'system', v_record.created_at);
    END LOOP;
  END LOOP;
END
$mig$;

-- Recrear RPC del portal con el nuevo campo
DROP FUNCTION IF EXISTS public.get_client_portal_settings(uuid);
CREATE OR REPLACE FUNCTION public.get_client_portal_settings(_client_id uuid)
 RETURNS TABLE(client_id uuid, allow_reservation_creation boolean, allow_extraordinary_requests boolean, allow_incidents boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, allow_reservation_creation, allow_extraordinary_requests, allow_incidents
  FROM public.clients
  WHERE id = _client_id;
$function$;
