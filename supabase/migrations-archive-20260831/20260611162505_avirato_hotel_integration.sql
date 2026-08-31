-- ============================================================
-- AVIRATO HOTEL INTEGRATION
-- API-first hotel sync with daily stay and checkout cleaning tasks.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.avirato_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL UNIQUE,
  operator_booking_id TEXT,
  master_booking_id TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  space_subtype_id INTEGER,
  space_name TEXT NOT NULL,
  space_subtype_name TEXT,
  guest_name TEXT,
  adults INTEGER NOT NULL DEFAULT 0,
  children INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  normalized_status TEXT NOT NULL,
  agency TEXT,
  segment TEXT,
  total_amount NUMERIC(10,2),
  sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_system TEXT NOT NULL DEFAULT 'avirato',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avirato_reservations_check_in
  ON public.avirato_reservations(check_in);
CREATE INDEX IF NOT EXISTS idx_avirato_reservations_check_out
  ON public.avirato_reservations(check_out);
CREATE INDEX IF NOT EXISTS idx_avirato_reservations_status
  ON public.avirato_reservations(normalized_status);
CREATE INDEX IF NOT EXISTS idx_avirato_reservations_space
  ON public.avirato_reservations(space_subtype_id);
CREATE INDEX IF NOT EXISTS idx_avirato_reservations_sede
  ON public.avirato_reservations(sede_id);

DROP TRIGGER IF EXISTS trg_avirato_reservations_updated_at ON public.avirato_reservations;
CREATE TRIGGER trg_avirato_reservations_updated_at
  BEFORE UPDATE ON public.avirato_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.avirato_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/manager leen reservas Avirato" ON public.avirato_reservations;
CREATE POLICY "Admin/manager leen reservas Avirato"
  ON public.avirato_reservations FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());

DROP POLICY IF EXISTS "Admin/manager gestionan reservas Avirato" ON public.avirato_reservations;
CREATE POLICY "Admin/manager gestionan reservas Avirato"
  ON public.avirato_reservations FOR ALL
  TO authenticated
  USING (public.user_is_admin_or_manager())
  WITH CHECK (public.user_is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.avirato_room_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  space_subtype_id INTEGER NOT NULL,
  space_name TEXT NOT NULL,
  service_kind TEXT NOT NULL CHECK (service_kind IN ('checkout', 'stay')),
  cliente_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  propiedad_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  task_type TEXT NOT NULL DEFAULT 'limpieza-turistica',
  default_start_time TIME NOT NULL DEFAULT '11:00',
  default_duration_min INTEGER NOT NULL DEFAULT 60 CHECK (default_duration_min >= 15 AND default_duration_min % 15 = 0),
  default_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (space_subtype_id, service_kind)
);

CREATE INDEX IF NOT EXISTS idx_avirato_room_mapping_space
  ON public.avirato_room_mapping(space_subtype_id);
CREATE INDEX IF NOT EXISTS idx_avirato_room_mapping_sede
  ON public.avirato_room_mapping(sede_id);

DROP TRIGGER IF EXISTS trg_avirato_room_mapping_updated_at ON public.avirato_room_mapping;
CREATE TRIGGER trg_avirato_room_mapping_updated_at
  BEFORE UPDATE ON public.avirato_room_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.avirato_room_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/manager leen mapeo Avirato" ON public.avirato_room_mapping;
CREATE POLICY "Admin/manager leen mapeo Avirato"
  ON public.avirato_room_mapping FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());

DROP POLICY IF EXISTS "Admin/manager gestionan mapeo Avirato" ON public.avirato_room_mapping;
CREATE POLICY "Admin/manager gestionan mapeo Avirato"
  ON public.avirato_room_mapping FOR ALL
  TO authenticated
  USING (public.user_is_admin_or_manager())
  WITH CHECK (public.user_is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.avirato_reservation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.avirato_reservations(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  space_subtype_id INTEGER NOT NULL,
  space_name TEXT NOT NULL,
  service_kind TEXT NOT NULL CHECK (service_kind IN ('checkout', 'stay')),
  task_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, space_subtype_id, service_kind, task_date)
);

CREATE INDEX IF NOT EXISTS idx_avirato_resv_tasks_reservation
  ON public.avirato_reservation_tasks(reservation_id);
CREATE INDEX IF NOT EXISTS idx_avirato_resv_tasks_task
  ON public.avirato_reservation_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_avirato_resv_tasks_date
  ON public.avirato_reservation_tasks(task_date);

DROP TRIGGER IF EXISTS trg_avirato_reservation_tasks_updated_at ON public.avirato_reservation_tasks;
CREATE TRIGGER trg_avirato_reservation_tasks_updated_at
  BEFORE UPDATE ON public.avirato_reservation_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.avirato_reservation_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/manager leen vinculos Avirato" ON public.avirato_reservation_tasks;
CREATE POLICY "Admin/manager leen vinculos Avirato"
  ON public.avirato_reservation_tasks FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());

DROP POLICY IF EXISTS "Admin/manager gestionan vinculos Avirato" ON public.avirato_reservation_tasks;
CREATE POLICY "Admin/manager gestionan vinculos Avirato"
  ON public.avirato_reservation_tasks FOR ALL
  TO authenticated
  USING (public.user_is_admin_or_manager())
  WITH CHECK (public.user_is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.avirato_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  triggered_by TEXT,
  schedule_name TEXT,
  preview BOOLEAN NOT NULL DEFAULT false,
  start_date DATE,
  end_date DATE,
  reservations_processed INTEGER NOT NULL DEFAULT 0,
  reservations_new INTEGER NOT NULL DEFAULT 0,
  reservations_updated INTEGER NOT NULL DEFAULT 0,
  reservations_cancelled INTEGER NOT NULL DEFAULT 0,
  blocks_detected INTEGER NOT NULL DEFAULT 0,
  stay_tasks_created INTEGER NOT NULL DEFAULT 0,
  checkout_tasks_created INTEGER NOT NULL DEFAULT 0,
  tasks_cancelled INTEGER NOT NULL DEFAULT 0,
  warnings TEXT[] NOT NULL DEFAULT '{}',
  errors TEXT[] NOT NULL DEFAULT '{}',
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avirato_sync_logs_created
  ON public.avirato_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_avirato_sync_logs_status
  ON public.avirato_sync_logs(status);

ALTER TABLE public.avirato_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/manager leen logs Avirato" ON public.avirato_sync_logs;
CREATE POLICY "Admin/manager leen logs Avirato"
  ON public.avirato_sync_logs FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());

DROP POLICY IF EXISTS "Admin/manager gestionan logs Avirato" ON public.avirato_sync_logs;
CREATE POLICY "Admin/manager gestionan logs Avirato"
  ON public.avirato_sync_logs FOR ALL
  TO authenticated
  USING (public.user_is_admin_or_manager())
  WITH CHECK (public.user_is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.avirato_sync_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_log_id UUID REFERENCES public.avirato_sync_logs(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES public.avirato_reservations(id) ON DELETE SET NULL,
  external_id TEXT,
  space_subtype_id INTEGER,
  space_name TEXT,
  error_type TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avirato_sync_errors_unresolved
  ON public.avirato_sync_errors(created_at DESC)
  WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_avirato_sync_errors_space
  ON public.avirato_sync_errors(space_subtype_id);

ALTER TABLE public.avirato_sync_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/manager leen errores Avirato" ON public.avirato_sync_errors;
CREATE POLICY "Admin/manager leen errores Avirato"
  ON public.avirato_sync_errors FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());

DROP POLICY IF EXISTS "Admin/manager gestionan errores Avirato" ON public.avirato_sync_errors;
CREATE POLICY "Admin/manager gestionan errores Avirato"
  ON public.avirato_sync_errors FOR ALL
  TO authenticated
  USING (public.user_is_admin_or_manager())
  WITH CHECK (public.user_is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.avirato_sync_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  minute INTEGER NOT NULL DEFAULT 0 CHECK (minute >= 0 AND minute <= 59),
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_avirato_sync_schedules_updated_at ON public.avirato_sync_schedules;
CREATE TRIGGER trg_avirato_sync_schedules_updated_at
  BEFORE UPDATE ON public.avirato_sync_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.avirato_sync_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/manager gestionan horarios Avirato" ON public.avirato_sync_schedules;
CREATE POLICY "Admin/manager gestionan horarios Avirato"
  ON public.avirato_sync_schedules FOR ALL
  TO authenticated
  USING (public.user_is_admin_or_manager())
  WITH CHECK (public.user_is_admin_or_manager());

INSERT INTO public.avirato_sync_schedules (name, hour, minute, timezone, is_active)
VALUES ('Sincronizacion Avirato piloto', 8, 30, 'Europe/Madrid', false)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.manage_avirato_cron_job(
  job_name text,
  cron_schedule text,
  function_url text,
  auth_header text,
  request_body text,
  job_timezone text DEFAULT 'Europe/Madrid'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  job_id bigint;
  utc_cron text;
  parts text[];
  hour_part int;
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname = job_name;

  parts := string_to_array(cron_schedule, ' ');
  IF array_length(parts, 1) >= 2 AND job_timezone = 'Europe/Madrid' THEN
    hour_part := parts[2]::int - 1;
    IF hour_part < 0 THEN
      hour_part := 23;
    END IF;
    parts[2] := hour_part::text;
    utc_cron := array_to_string(parts, ' ');
  ELSE
    utc_cron := cron_schedule;
  END IF;

  SELECT cron.schedule(
    job_name,
    utc_cron,
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);',
      function_url,
      auth_header,
      request_body
    )
  )
  INTO job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', job_id,
    'job_name', job_name,
    'local_schedule', cron_schedule,
    'utc_schedule', utc_cron,
    'timezone', job_timezone
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_avirato_cron_job(job_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname = job_name;

  RETURN jsonb_build_object('success', true, 'job_name', job_name);
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_avirato_cron_jobs()
RETURNS TABLE(jobid bigint, schedule text, command text, active boolean, jobname text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT jobid, schedule, command, active, jobname
  FROM cron.job
  WHERE jobname LIKE 'avirato_sync_%'
  ORDER BY jobname;
$function$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avirato_reservations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avirato_room_mapping TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avirato_reservation_tasks TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avirato_sync_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avirato_sync_errors TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avirato_sync_schedules TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.manage_avirato_cron_job(text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_avirato_cron_job(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_avirato_cron_jobs() TO authenticated, service_role;
