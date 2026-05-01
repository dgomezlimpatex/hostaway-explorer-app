
-- 1) Toggle por cliente
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS allow_extraordinary_requests boolean NOT NULL DEFAULT false;

-- 2) Catálogo de tipos de servicios extraordinarios
CREATE TABLE IF NOT EXISTS public.extraordinary_request_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  icon text,
  description text,
  default_duration_minutes integer NOT NULL DEFAULT 15,
  requires_time boolean NOT NULL DEFAULT false,
  default_cost numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  sede_id uuid REFERENCES public.sedes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ert_active_sort
  ON public.extraordinary_request_types (is_active, sort_order);

ALTER TABLE public.extraordinary_request_types ENABLE ROW LEVEL SECURITY;

-- Lectura pública (anon + authenticated) de los activos
CREATE POLICY "Public can read active extraordinary types"
  ON public.extraordinary_request_types FOR SELECT
  USING (is_active = true);

-- Admin/manager pueden gestionar todo
CREATE POLICY "Admin/manager manage extraordinary types"
  ON public.extraordinary_request_types FOR ALL
  USING (public.user_is_admin_or_manager())
  WITH CHECK (public.user_is_admin_or_manager());

CREATE TRIGGER update_ert_updated_at
  BEFORE UPDATE ON public.extraordinary_request_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Solicitudes extraordinarias del cliente
CREATE TABLE IF NOT EXISTS public.client_extraordinary_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.client_reservations(id) ON DELETE SET NULL,
  request_type_id uuid REFERENCES public.extraordinary_request_types(id) ON DELETE SET NULL,
  request_type_label_snapshot text NOT NULL,
  service_date date NOT NULL,
  service_time time,
  guest_name text,
  notes text,
  cost_snapshot numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cer_status_check CHECK (status IN ('active','cancelled','completed'))
);

CREATE INDEX IF NOT EXISTS idx_cer_client ON public.client_extraordinary_requests (client_id, service_date DESC);
CREATE INDEX IF NOT EXISTS idx_cer_property ON public.client_extraordinary_requests (property_id, service_date);
CREATE INDEX IF NOT EXISTS idx_cer_sede ON public.client_extraordinary_requests (sede_id, service_date);
CREATE INDEX IF NOT EXISTS idx_cer_task ON public.client_extraordinary_requests (task_id);

ALTER TABLE public.client_extraordinary_requests ENABLE ROW LEVEL SECURITY;

-- Anon SELECT: solo solicitudes de clientes con portal activo
CREATE POLICY "Public read of own client extraordinary requests"
  ON public.client_extraordinary_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_portal_access cpa
      WHERE cpa.client_id = client_extraordinary_requests.client_id
        AND cpa.is_active = true
    )
  );

-- Admin/manager/supervisor con acceso a la sede
CREATE POLICY "Staff manage extraordinary requests by sede"
  ON public.client_extraordinary_requests FOR ALL
  USING (
    public.user_is_admin_or_manager()
    OR public.user_can_access_task(sede_id)
  )
  WITH CHECK (
    public.user_is_admin_or_manager()
    OR public.user_can_access_task(sede_id)
  );

CREATE TRIGGER update_cer_updated_at
  BEFORE UPDATE ON public.client_extraordinary_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RPC: crear solicitud + tarea atómicamente
CREATE OR REPLACE FUNCTION public.create_extraordinary_request_with_task(
  _client_id uuid,
  _property_id uuid,
  _request_type_id uuid,
  _service_date date,
  _service_time time DEFAULT NULL,
  _guest_name text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _reservation_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client RECORD;
  v_property RECORD;
  v_type RECORD;
  v_portal_active boolean;
  v_today_count int;
  v_start_time time;
  v_end_time time;
  v_duration_min int;
  v_task_id uuid;
  v_request_id uuid;
  v_notes_full text;
BEGIN
  IF _client_id IS NULL OR _property_id IS NULL OR _request_type_id IS NULL OR _service_date IS NULL THEN
    RAISE EXCEPTION 'Faltan campos requeridos';
  END IF;

  IF _service_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha del servicio no puede ser anterior a hoy';
  END IF;

  IF _service_date > CURRENT_DATE + INTERVAL '90 days' THEN
    RAISE EXCEPTION 'La fecha del servicio no puede superar 90 días';
  END IF;

  -- Cliente y toggle
  SELECT id, nombre, allow_extraordinary_requests, sede_id
  INTO v_client
  FROM public.clients
  WHERE id = _client_id;

  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  IF v_client.allow_extraordinary_requests IS NOT TRUE THEN
    RAISE EXCEPTION 'Este cliente no tiene activadas las solicitudes extraordinarias';
  END IF;

  -- Portal activo
  SELECT EXISTS (
    SELECT 1 FROM public.client_portal_access
    WHERE client_id = _client_id AND is_active = true
  ) INTO v_portal_active;

  IF NOT v_portal_active THEN
    RAISE EXCEPTION 'El portal del cliente no está activo';
  END IF;

  -- Propiedad
  SELECT id, nombre, direccion, sede_id
  INTO v_property
  FROM public.properties
  WHERE id = _property_id;

  IF v_property.id IS NULL THEN
    RAISE EXCEPTION 'Propiedad no encontrada';
  END IF;

  -- Tipo
  SELECT id, label, default_cost, default_duration_minutes, requires_time, is_active
  INTO v_type
  FROM public.extraordinary_request_types
  WHERE id = _request_type_id;

  IF v_type.id IS NULL OR v_type.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Tipo de solicitud no disponible';
  END IF;

  IF v_type.requires_time = true AND _service_time IS NULL THEN
    RAISE EXCEPTION 'Este servicio requiere una hora';
  END IF;

  -- Rate limit simple: máximo 10/cliente/día
  SELECT COUNT(*) INTO v_today_count
  FROM public.client_extraordinary_requests
  WHERE client_id = _client_id
    AND created_at >= (CURRENT_DATE::timestamp);

  IF v_today_count >= 10 THEN
    RAISE EXCEPTION 'Has alcanzado el máximo de solicitudes diarias (10)';
  END IF;

  -- Calcular ventana horaria de la tarea
  v_duration_min := COALESCE(v_type.default_duration_minutes, 15);
  IF v_duration_min < 15 THEN v_duration_min := 15; END IF;

  v_start_time := COALESCE(_service_time, TIME '09:00');
  v_end_time := (v_start_time + (v_duration_min || ' minutes')::interval)::time;

  -- Notas
  v_notes_full := '[SOLICITUD CLIENTE - ' || v_type.label || ']';
  IF _guest_name IS NOT NULL AND length(trim(_guest_name)) > 0 THEN
    v_notes_full := v_notes_full || ' Huésped: ' || _guest_name || '.';
  END IF;
  IF _notes IS NOT NULL AND length(trim(_notes)) > 0 THEN
    v_notes_full := v_notes_full || ' ' || _notes;
  END IF;

  -- Crear tarea
  INSERT INTO public.tasks (
    property, address, start_time, end_time, type, status,
    check_in, check_out, date, cliente_id, propiedad_id,
    duracion, coste, notes, sede_id
  ) VALUES (
    v_property.nombre,
    COALESCE(v_property.direccion, ''),
    v_start_time,
    v_end_time,
    'trabajo-extraordinario',
    'pending',
    v_start_time,
    v_end_time,
    _service_date,
    _client_id,
    _property_id,
    v_duration_min,
    COALESCE(v_type.default_cost, 0),
    v_notes_full,
    v_property.sede_id
  )
  RETURNING id INTO v_task_id;

  -- Crear registro de solicitud
  INSERT INTO public.client_extraordinary_requests (
    client_id, property_id, reservation_id, request_type_id,
    request_type_label_snapshot, service_date, service_time,
    guest_name, notes, cost_snapshot, status, task_id, sede_id
  ) VALUES (
    _client_id, _property_id, _reservation_id, _request_type_id,
    v_type.label, _service_date, _service_time,
    _guest_name, _notes, COALESCE(v_type.default_cost, 0), 'active',
    v_task_id, v_property.sede_id
  )
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'request_id', v_request_id,
    'task_id', v_task_id,
    'cost', COALESCE(v_type.default_cost, 0),
    'label', v_type.label
  );
END;
$$;

-- Permitir invocar desde anon y authenticated (la propia función valida portal activo)
GRANT EXECUTE ON FUNCTION public.create_extraordinary_request_with_task(uuid, uuid, uuid, date, time, text, text, uuid) TO anon, authenticated;

-- 5) RPC: cancelar solicitud (cancela también la tarea)
CREATE OR REPLACE FUNCTION public.cancel_extraordinary_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_portal_active boolean;
BEGIN
  SELECT * INTO v_req FROM public.client_extraordinary_requests WHERE id = _request_id;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  -- Si NO es admin/manager, validar portal activo del cliente (auth = anon o cliente)
  IF NOT public.user_is_admin_or_manager() THEN
    SELECT EXISTS (
      SELECT 1 FROM public.client_portal_access
      WHERE client_id = v_req.client_id AND is_active = true
    ) INTO v_portal_active;
    IF NOT v_portal_active THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;
  END IF;

  UPDATE public.client_extraordinary_requests
  SET status = 'cancelled', updated_at = now()
  WHERE id = _request_id;

  IF v_req.task_id IS NOT NULL THEN
    UPDATE public.tasks SET status = 'cancelled', updated_at = now() WHERE id = v_req.task_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_extraordinary_request(uuid) TO anon, authenticated;

-- 6) Catálogo inicial (sede_id NULL = global)
INSERT INTO public.extraordinary_request_types (code, label, icon, default_duration_minutes, requires_time, default_cost, sort_order)
VALUES
  ('early_checkin', 'Early Check-in', '🌅', 0, true, 30, 1),
  ('late_checkout', 'Late Check-out', '🌇', 0, true, 30, 2),
  ('cuna', 'Cuna', '🛏️', 15, false, 0, 3),
  ('silla_bebe', 'Silla bebé', '🪑', 15, false, 0, 4),
  ('decoracion_especial', 'Decoración especial', '🎉', 30, false, 50, 5),
  ('welcome_pack_extra', 'Welcome pack extra', '🎁', 15, false, 25, 6)
ON CONFLICT (code) DO NOTHING;
