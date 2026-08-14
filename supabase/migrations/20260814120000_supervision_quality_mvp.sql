-- Supervisión y control de calidad MVP.
-- Cambio aditivo: no modifica ni elimina datos operativos existentes.

DO $$ BEGIN
  CREATE TYPE public.supervision_route_status AS ENUM ('planned', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supervision_stop_type AS ENUM ('apartment', 'storage');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supervision_stop_status AS ENUM ('pending', 'in_progress', 'reviewed', 'needs_rework', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supervision_review_type AS ENUM ('quick', 'full');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supervision_review_state AS ENUM ('reviewed', 'with_incidents', 'returned_for_rework', 'historical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supervision_review_result AS ENUM ('correct', 'incorrect');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supervision_incident_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supervision_incident_status AS ENUM ('open', 'in_progress', 'resolved', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.task_checklists_templates
  ADD COLUMN IF NOT EXISTS template_kind TEXT NOT NULL DEFAULT 'cleaning',
  ADD COLUMN IF NOT EXISTS property_group_id UUID REFERENCES public.property_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS review_interval_days INTEGER,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.supervision_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  route_date DATE NOT NULL,
  name TEXT NOT NULL,
  reviewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.supervision_route_status NOT NULL DEFAULT 'planned',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supervision_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.supervision_routes(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 1,
  stop_type public.supervision_stop_type NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  property_group_id UUID REFERENCES public.property_groups(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  access_note TEXT,
  status public.supervision_stop_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(route_id, sequence)
);

CREATE TABLE IF NOT EXISTS public.supervision_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.supervision_routes(id) ON DELETE CASCADE,
  route_stop_id UUID NOT NULL REFERENCES public.supervision_route_stops(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  property_group_id UUID REFERENCES public.property_groups(id) ON DELETE SET NULL,
  reviewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_type public.supervision_review_type NOT NULL DEFAULT 'quick',
  state public.supervision_review_state NOT NULL DEFAULT 'reviewed',
  result public.supervision_review_result NOT NULL DEFAULT 'correct',
  notes TEXT,
  rework_reason TEXT,
  checklist_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  inventory_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supervision_review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.supervision_reviews(id) ON DELETE CASCADE,
  from_state public.supervision_review_state,
  to_state public.supervision_review_state NOT NULL,
  reason TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supervision_reservation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_stop_id UUID NOT NULL REFERENCES public.supervision_route_stops(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'task',
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  guests INTEGER,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supervision_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  route_id UUID NOT NULL REFERENCES public.supervision_routes(id) ON DELETE CASCADE,
  route_stop_id UUID REFERENCES public.supervision_route_stops(id) ON DELETE SET NULL,
  review_id UUID REFERENCES public.supervision_reviews(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  property_group_id UUID REFERENCES public.property_groups(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  priority public.supervision_incident_priority NOT NULL DEFAULT 'medium',
  status public.supervision_incident_status NOT NULL DEFAULT 'open',
  description TEXT NOT NULL,
  responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_date DATE,
  repeat_key TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supervision_incident_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.supervision_incidents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'status_change', 'priority_change', 'responsible_changed', 'archived')),
  from_status public.supervision_incident_status,
  to_status public.supervision_incident_status,
  note TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supervision_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.supervision_routes(id) ON DELETE CASCADE,
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  report_date DATE NOT NULL,
  pdf_path TEXT,
  email_to TEXT NOT NULL DEFAULT 'dgomez@limpatex.com',
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(route_id)
);

CREATE INDEX IF NOT EXISTS idx_supervision_routes_sede_date ON public.supervision_routes(sede_id, route_date DESC);
CREATE INDEX IF NOT EXISTS idx_supervision_stops_route_sequence ON public.supervision_route_stops(route_id, sequence);
CREATE INDEX IF NOT EXISTS idx_supervision_reviews_route_stop ON public.supervision_reviews(route_id, route_stop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supervision_incidents_sede_status ON public.supervision_incidents(sede_id, status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supervision_incidents_repeat_key ON public.supervision_incidents(repeat_key, created_at DESC);

DROP TRIGGER IF EXISTS trg_supervision_routes_updated_at ON public.supervision_routes;
CREATE TRIGGER trg_supervision_routes_updated_at BEFORE UPDATE ON public.supervision_routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_supervision_stops_updated_at ON public.supervision_route_stops;
CREATE TRIGGER trg_supervision_stops_updated_at BEFORE UPDATE ON public.supervision_route_stops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_supervision_reviews_updated_at ON public.supervision_reviews;
CREATE TRIGGER trg_supervision_reviews_updated_at BEFORE UPDATE ON public.supervision_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_supervision_incidents_updated_at ON public.supervision_incidents;
CREATE TRIGGER trg_supervision_incidents_updated_at BEFORE UPDATE ON public.supervision_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.supervision_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_reservation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supervision_routes_scope ON public.supervision_routes;
CREATE POLICY supervision_routes_scope ON public.supervision_routes FOR ALL TO authenticated
USING (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), sede_id))
WITH CHECK (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), sede_id));

DROP POLICY IF EXISTS supervision_stops_scope ON public.supervision_route_stops;
CREATE POLICY supervision_stops_scope ON public.supervision_route_stops FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), r.sede_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), r.sede_id))));

DROP POLICY IF EXISTS supervision_reviews_scope ON public.supervision_reviews;
CREATE POLICY supervision_reviews_scope ON public.supervision_reviews FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), r.sede_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), r.sede_id))));

DROP POLICY IF EXISTS supervision_review_events_scope ON public.supervision_review_events;
CREATE POLICY supervision_review_events_scope ON public.supervision_review_events FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_reviews v JOIN public.supervision_routes r ON r.id = v.route_id WHERE v.id = review_id AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), r.sede_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_reviews v JOIN public.supervision_routes r ON r.id = v.route_id WHERE v.id = review_id AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), r.sede_id))));

DROP POLICY IF EXISTS supervision_reservations_scope ON public.supervision_reservation_snapshots;
CREATE POLICY supervision_reservations_scope ON public.supervision_reservation_snapshots FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_route_stops s JOIN public.supervision_routes r ON r.id = s.route_id WHERE s.id = route_stop_id AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), r.sede_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_route_stops s JOIN public.supervision_routes r ON r.id = s.route_id WHERE s.id = route_stop_id AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), r.sede_id))));

DROP POLICY IF EXISTS supervision_incidents_scope ON public.supervision_incidents;
CREATE POLICY supervision_incidents_scope ON public.supervision_incidents FOR ALL TO authenticated
USING (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), sede_id))
WITH CHECK (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), sede_id));

DROP POLICY IF EXISTS supervision_incident_events_scope ON public.supervision_incident_events;
CREATE POLICY supervision_incident_events_scope ON public.supervision_incident_events FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_incidents i WHERE i.id = incident_id AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), i.sede_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_incidents i WHERE i.id = incident_id AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), i.sede_id))));

DROP POLICY IF EXISTS supervision_daily_reports_scope ON public.supervision_daily_reports;
CREATE POLICY supervision_daily_reports_scope ON public.supervision_daily_reports FOR ALL TO authenticated
USING (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), sede_id))
WITH CHECK (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), sede_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervision_routes, public.supervision_route_stops, public.supervision_reviews, public.supervision_review_events, public.supervision_reservation_snapshots, public.supervision_incidents, public.supervision_incident_events, public.supervision_daily_reports TO authenticated;

INSERT INTO public.task_checklists_templates (property_type, template_name, checklist_items, template_kind, version, review_interval_days)
SELECT 'supervision_apartment', 'Supervisión apartamento · revisión completa v1', '[
  {"id":"cleanliness","category":"Limpieza","task":"Limpieza general y superficies","required":true},
  {"id":"bathroom","category":"Limpieza","task":"Baño completo y consumibles","required":true},
  {"id":"beds","category":"Lencería","task":"Camas, toallas y lencería preparada","required":true},
  {"id":"kitchen","category":"Cocina","task":"Cocina, electrodomésticos y menaje","required":true},
  {"id":"equipment","category":"Equipamiento","task":"Equipamiento y aparatos revisados","required":false},
  {"id":"access","category":"Salida","task":"Puertas, ventanas y accesos seguros","required":true}
]'::jsonb, 'supervision_apartment', 1, 15
WHERE NOT EXISTS (SELECT 1 FROM public.task_checklists_templates WHERE template_kind = 'supervision_apartment' AND version = 1);

INSERT INTO public.task_checklists_templates (property_type, template_name, checklist_items, template_kind, version, review_interval_days)
SELECT 'supervision_storage', 'Supervisión trastero · control operativo v1', '[
  {"id":"organization","category":"Organización","task":"Trastero organizado y transitable","required":true},
  {"id":"products","category":"Productos","task":"Productos y consumibles suficientes","required":true},
  {"id":"material","category":"Material","task":"Material operativo disponible","required":true},
  {"id":"linen","category":"Lencería","task":"Lencería de repuesto suficiente","required":true},
  {"id":"duvets","category":"Edredones","task":"Edredones y mantas almacenados","required":false},
  {"id":"reserve-tableware","category":"Menaje","task":"Menaje de reserva disponible","required":false}
]'::jsonb, 'supervision_storage', 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.task_checklists_templates WHERE template_kind = 'supervision_storage' AND version = 1);

INSERT INTO storage.buckets (id, name, public)
VALUES ('supervision-evidence', 'supervision-evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS supervision_evidence_read ON storage.objects;
CREATE POLICY supervision_evidence_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'supervision-evidence');
DROP POLICY IF EXISTS supervision_evidence_write ON storage.objects;
CREATE POLICY supervision_evidence_write ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'supervision-evidence');
DROP POLICY IF EXISTS supervision_evidence_update ON storage.objects;
CREATE POLICY supervision_evidence_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'supervision-evidence') WITH CHECK (bucket_id = 'supervision-evidence');
