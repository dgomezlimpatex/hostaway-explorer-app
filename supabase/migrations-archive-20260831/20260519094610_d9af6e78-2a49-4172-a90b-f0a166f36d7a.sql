
-- ============================================================
-- LITTLE HOTELIER INTEGRATION TABLES
-- ============================================================

-- 1) lh_reservations: mirror of LH reservations
CREATE TABLE public.lh_reservations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id    TEXT UNIQUE NOT NULL,
  uuid           TEXT,
  reference      TEXT,
  channel        TEXT,
  check_in       DATE NOT NULL,
  check_out      DATE NOT NULL,
  room           TEXT NOT NULL,
  guest_name     TEXT,
  adults         INTEGER DEFAULT 0,
  children       INTEGER DEFAULT 0,
  infants        INTEGER DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'confirmed',
  total          TEXT,
  synced_at      TIMESTAMPTZ,
  sede_id        UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  source_system  TEXT NOT NULL DEFAULT 'little_hotelier',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lh_reservations_check_in  ON public.lh_reservations(check_in);
CREATE INDEX idx_lh_reservations_check_out ON public.lh_reservations(check_out);
CREATE INDEX idx_lh_reservations_status    ON public.lh_reservations(status);
CREATE INDEX idx_lh_reservations_room      ON public.lh_reservations(room);
CREATE INDEX idx_lh_reservations_sede      ON public.lh_reservations(sede_id);

CREATE TRIGGER trg_lh_reservations_updated_at
  BEFORE UPDATE ON public.lh_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lh_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager pueden leer reservas LH"
  ON public.lh_reservations FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());

-- service_role bypasses RLS automatically, no policy needed for writes.

-- 2) lh_room_mapping: room -> property mapping per service kind
CREATE TABLE public.lh_room_mapping (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id              UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  lh_room              TEXT NOT NULL,
  service_kind         TEXT NOT NULL CHECK (service_kind IN ('checkout','stay')),
  cliente_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  propiedad_id         UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  task_type            TEXT NOT NULL DEFAULT 'limpieza-turistica',
  default_start_time   TIME NOT NULL DEFAULT '11:00',
  default_duration_min INTEGER NOT NULL DEFAULT 60 CHECK (default_duration_min >= 15 AND default_duration_min % 15 = 0),
  default_cost         NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sede_id, lh_room, service_kind)
);

CREATE INDEX idx_lh_room_mapping_room ON public.lh_room_mapping(lh_room);
CREATE INDEX idx_lh_room_mapping_sede ON public.lh_room_mapping(sede_id);

CREATE TRIGGER trg_lh_room_mapping_updated_at
  BEFORE UPDATE ON public.lh_room_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lh_room_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager leen mapeo LH"
  ON public.lh_room_mapping FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());

CREATE POLICY "Admin/manager gestionan mapeo LH"
  ON public.lh_room_mapping FOR ALL
  TO authenticated
  USING (public.user_is_admin_or_manager())
  WITH CHECK (public.user_is_admin_or_manager());

-- 3) lh_reservation_tasks: link table reservation <-> task
CREATE TABLE public.lh_reservation_tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.lh_reservations(id) ON DELETE CASCADE,
  task_id        UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  service_kind   TEXT NOT NULL CHECK (service_kind IN ('checkout','stay')),
  task_date      DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active', -- active | cancelled
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, service_kind, task_date)
);

CREATE INDEX idx_lh_resv_tasks_reservation ON public.lh_reservation_tasks(reservation_id);
CREATE INDEX idx_lh_resv_tasks_task        ON public.lh_reservation_tasks(task_id);

CREATE TRIGGER trg_lh_reservation_tasks_updated_at
  BEFORE UPDATE ON public.lh_reservation_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lh_reservation_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager leen vínculos LH"
  ON public.lh_reservation_tasks FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());

-- 4) lh_sync_logs: debug log of incoming POSTs
CREATE TABLE public.lh_sync_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id    TEXT,
  status_code    INTEGER,
  success        BOOLEAN NOT NULL DEFAULT true,
  payload        JSONB,
  result         JSONB,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lh_sync_logs_created   ON public.lh_sync_logs(created_at DESC);
CREATE INDEX idx_lh_sync_logs_external  ON public.lh_sync_logs(external_id);

ALTER TABLE public.lh_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager leen logs LH"
  ON public.lh_sync_logs FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());
