-- Remediación incremental: conserva el destinatario efectivo de cancelaciones
-- y separa la entrega lógica de los dos POST permitidos a Meta. Las deliveries
-- legacy que ya consumieron el primer POST se materializan antes de habilitar
-- los nuevos writers para no perder presupuesto durante el upgrade.

CREATE OR REPLACE FUNCTION public.snapshot_notification_recipient(_cleaner public.cleaners)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  telefono_digits text;
  whatsapp_digits text;
  telefono_national text;
  whatsapp_national text;
  canonical_phone text;
BEGIN
  telefono_digits := regexp_replace(COALESCE(_cleaner.telefono, ''), '[^0-9]', '', 'g');
  whatsapp_digits := regexp_replace(COALESCE(_cleaner.whatsapp_phone_e164, ''), '[^0-9]', '', 'g');

  telefono_national := CASE
    WHEN length(telefono_digits) = 9 THEN telefono_digits
    WHEN length(telefono_digits) = 11 AND telefono_digits LIKE '34%' THEN right(telefono_digits, 9)
    WHEN length(telefono_digits) = 13 AND telefono_digits LIKE '0034%' THEN right(telefono_digits, 9)
    ELSE NULL
  END;
  whatsapp_national := CASE
    WHEN length(whatsapp_digits) = 9 THEN whatsapp_digits
    WHEN length(whatsapp_digits) = 11 AND whatsapp_digits LIKE '34%' THEN right(whatsapp_digits, 9)
    WHEN length(whatsapp_digits) = 13 AND whatsapp_digits LIKE '0034%' THEN right(whatsapp_digits, 9)
    ELSE NULL
  END;

  -- Paridad con el proveedor: solo móviles españoles 6xx/7xx. Un fijo en
  -- telefono no tapa un whatsapp_phone_e164 móvil válido y no se consulta
  -- ningún flag/opt-in para decidir qué número queda congelado.
  canonical_phone := CASE
    WHEN length(telefono_national) = 9
      AND substring(telefono_national from 1 for 1) IN ('6', '7')
      THEN '+34' || telefono_national
    WHEN length(whatsapp_national) = 9
      AND substring(whatsapp_national from 1 for 1) IN ('6', '7')
      THEN '+34' || whatsapp_national
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'name', _cleaner.name,
    'email', _cleaner.email,
    'telefono', canonical_phone,
    'whatsapp_phone_e164', canonical_phone,
    'effective_phone_e164', canonical_phone,
    'whatsapp_notifications_enabled', _cleaner.whatsapp_notifications_enabled,
    'whatsapp_opt_in', _cleaner.whatsapp_opt_in
  );
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_notification_recipient(public.cleaners)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_deleted_task_cancellations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  assignment_row public.task_assignments%ROWTYPE;
  cleaner_row public.cleaners%ROWTYPE;
  recipient_snapshot jsonb;
BEGIN
  FOR assignment_row IN
    SELECT candidate.*
    FROM public.task_assignments candidate
    WHERE candidate.task_id = OLD.id
      AND candidate.cleaner_id IS NOT NULL
    ORDER BY candidate.id
  LOOP
    SELECT cleaner.* INTO cleaner_row
    FROM public.cleaners cleaner
    WHERE cleaner.id = assignment_row.cleaner_id;

    recipient_snapshot := CASE WHEN cleaner_row.id IS NOT NULL
      THEN public.snapshot_notification_recipient(cleaner_row)
      ELSE jsonb_build_object(
        'name', assignment_row.cleaner_name,
        'email', NULL,
        'telefono', NULL,
        'whatsapp_phone_e164', NULL,
        'effective_phone_e164', NULL,
        'whatsapp_notifications_enabled', false,
        'whatsapp_opt_in', false
      ) END;

    INSERT INTO public.notification_events (
      event_type, entity_type, entity_id, task_id, cleaner_id, sede_id,
      payload, snapshot, dedupe_key, status
    ) VALUES (
      'task_cancelled', 'tasks', OLD.id, OLD.id, assignment_row.cleaner_id, OLD.sede_id,
      jsonb_build_object(
        'source', 'tasks_before_delete_trigger',
        'assignment_id', assignment_row.id,
        'operation', 'delete'
      ),
      jsonb_build_object(
        'task', jsonb_build_object(
          'id', OLD.id, 'property', OLD.property, 'address', OLD.address,
          'date', OLD.date, 'start_time', OLD.start_time, 'end_time', OLD.end_time,
          'sede_id', OLD.sede_id
        ),
        'assignment', jsonb_build_object(
          'id', assignment_row.id, 'cleaner_id', assignment_row.cleaner_id,
          'cleaner_name', assignment_row.cleaner_name
        ),
        'recipient', recipient_snapshot
      ),
      concat('task_cancelled:', OLD.id::text, ':', assignment_row.cleaner_id::text,
        ':assignment:', assignment_row.id::text),
      'pending'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;
  RETURN OLD;
END;
$$;

-- Captura cada asignación mientras la fila cleaners todavía es visible. La FK
-- borra task_assignments en cascada después; su trigger AFTER DELETE usa la misma
-- dedupe_key por assignment y por tanto no puede crear una segunda cancelación.
CREATE OR REPLACE FUNCTION public.enqueue_deleted_cleaner_cancellations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  assignment_row public.task_assignments%ROWTYPE;
  task_row public.tasks%ROWTYPE;
  recipient_snapshot jsonb;
BEGIN
  recipient_snapshot := public.snapshot_notification_recipient(OLD);

  FOR assignment_row IN
    SELECT candidate.*
    FROM public.task_assignments candidate
    WHERE candidate.cleaner_id = OLD.id
    ORDER BY candidate.id
  LOOP
    SELECT task.* INTO task_row
    FROM public.tasks task
    WHERE task.id = assignment_row.task_id;

    IF task_row.id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notification_events (
      event_type, entity_type, entity_id, task_id, cleaner_id, sede_id,
      payload, snapshot, dedupe_key, status
    ) VALUES (
      'task_cancelled', 'tasks', task_row.id, task_row.id, OLD.id, task_row.sede_id,
      jsonb_build_object(
        'source', 'tasks_before_cleaner_delete_trigger',
        'assignment_id', assignment_row.id,
        'operation', 'delete'
      ),
      jsonb_build_object(
        'task', jsonb_build_object(
          'id', task_row.id, 'property', task_row.property, 'address', task_row.address,
          'date', task_row.date, 'start_time', task_row.start_time, 'end_time', task_row.end_time,
          'sede_id', task_row.sede_id
        ),
        'assignment', jsonb_build_object(
          'id', assignment_row.id, 'cleaner_id', OLD.id,
          'cleaner_name', assignment_row.cleaner_name
        ),
        'recipient', recipient_snapshot
      ),
      concat('task_cancelled:', task_row.id::text, ':', OLD.id::text,
        ':assignment:', assignment_row.id::text),
      'pending'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleaners_enqueue_deleted_cleaner_cancellations
  ON public.cleaners;
CREATE TRIGGER trg_cleaners_enqueue_deleted_cleaner_cancellations
BEFORE DELETE ON public.cleaners
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_deleted_cleaner_cancellations();

CREATE OR REPLACE FUNCTION public.enqueue_task_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  assignment_row public.task_assignments%ROWTYPE;
  notification_type text;
  task_record public.tasks%ROWTYPE;
  cleaner_row public.cleaners%ROWTYPE;
  event_snapshot jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    assignment_row := NEW;
    notification_type := 'task_assigned';
  ELSE
    assignment_row := OLD;
    notification_type := 'task_cancelled';
  END IF;

  SELECT task.* INTO task_record FROM public.tasks task
  WHERE task.id = assignment_row.task_id;
  IF NOT FOUND OR assignment_row.cleaner_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF notification_type = 'task_cancelled' THEN
    SELECT cleaner.* INTO cleaner_row FROM public.cleaners cleaner
    WHERE cleaner.id = assignment_row.cleaner_id;
    event_snapshot := jsonb_build_object(
      'task', jsonb_build_object(
        'id', task_record.id, 'property', task_record.property,
        'address', task_record.address, 'date', task_record.date,
        'start_time', task_record.start_time, 'end_time', task_record.end_time,
        'sede_id', task_record.sede_id
      ),
      'assignment', jsonb_build_object(
        'id', assignment_row.id, 'cleaner_id', assignment_row.cleaner_id,
        'cleaner_name', assignment_row.cleaner_name
      ),
      'recipient', CASE WHEN cleaner_row.id IS NOT NULL
        THEN public.snapshot_notification_recipient(cleaner_row)
        ELSE jsonb_build_object(
          'name', assignment_row.cleaner_name, 'email', NULL, 'telefono', NULL,
          'whatsapp_phone_e164', NULL, 'effective_phone_e164', NULL,
          'whatsapp_notifications_enabled', false, 'whatsapp_opt_in', false
        ) END
    );
  END IF;

  INSERT INTO public.notification_events (
    event_type, entity_type, entity_id, task_id, cleaner_id, sede_id,
    payload, snapshot, dedupe_key, status
  ) VALUES (
    notification_type, 'tasks', assignment_row.task_id, assignment_row.task_id,
    assignment_row.cleaner_id, task_record.sede_id,
    jsonb_build_object(
      'source', 'task_assignments_after_write_trigger',
      'assignment_id', assignment_row.id,
      'operation', lower(TG_OP)
    ),
    event_snapshot,
    concat(notification_type, ':', assignment_row.task_id::text, ':',
      assignment_row.cleaner_id::text, ':assignment:', assignment_row.id::text),
    'pending'
  )
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_deleted_task_cancellations()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_deleted_cleaner_cancellations()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_task_assignment_notification()
  FROM PUBLIC, anon, authenticated;

CREATE TABLE public.notification_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.notification_deliveries(id) ON DELETE CASCADE,
  attempt_no smallint NOT NULL CHECK (attempt_no BETWEEN 1 AND 2),
  claim_token uuid NOT NULL,
  event_lease_token uuid NOT NULL,
  state text NOT NULL CHECK (state IN (
    'contacting_meta', 'completed_uncertain', 'accepted', 'failed',
    'callback_observed', 'reconciled'
  )),
  provider_message_id text,
  provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_source text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  last_status text,
  status_occurred_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_id, attempt_no),
  UNIQUE (claim_token)
);

CREATE UNIQUE INDEX idx_notification_delivery_attempts_provider_message_id
ON public.notification_delivery_attempts (provider_message_id)
WHERE provider_message_id IS NOT NULL;
CREATE INDEX idx_notification_delivery_attempts_delivery
ON public.notification_delivery_attempts (delivery_id, attempt_no);

ALTER TABLE public.notification_delivery_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_delivery_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notification_delivery_attempts TO service_role;

-- Upgrade 20260721102400 -> 20260721152000. Antes de existir attempt history el
-- presupuesto vivía solo en provider_payload. Cada fila que declara haber
-- consumido POST 1 obtiene exactamente un child. El INSERT es idempotente y
-- conserva el provider_message_id conocido en vez de abrir un retry espurio.
INSERT INTO public.notification_delivery_attempts (
  delivery_id, attempt_no, claim_token, event_lease_token, state,
  provider_message_id, provider_response, correlation_source,
  started_at, finalized_at, last_status, status_occurred_at,
  error_code, error_message
)
SELECT
  delivery.id,
  1,
  gen_random_uuid(),
  COALESCE(
    event.processing_lease_token,
    CASE
      WHEN delivery.provider_payload->>'send_lease_token'
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (delivery.provider_payload->>'send_lease_token')::uuid
      ELSE NULL
    END,
    gen_random_uuid()
  ),
  CASE
    WHEN delivery.provider_message_id IS NOT NULL
      OR delivery.status IN ('sent', 'delivered', 'read') THEN 'reconciled'
    WHEN delivery.status = 'queued'
      AND delivery.provider_payload->>'meta_attempt_state' = 'contacting_meta'
      THEN 'contacting_meta'
    ELSE 'completed_uncertain'
  END,
  delivery.provider_message_id,
  COALESCE(delivery.provider_response, '{}'::jsonb),
  CASE WHEN delivery.provider_message_id IS NOT NULL THEN 'legacy_parent' ELSE NULL END,
  COALESCE(
    CASE
      WHEN delivery.provider_payload->>'send_started_at'
        ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}'
      THEN (delivery.provider_payload->>'send_started_at')::timestamptz
      ELSE NULL
    END,
    delivery.sent_at,
    delivery.created_at
  ),
  CASE
    WHEN delivery.status = 'queued'
      AND delivery.provider_payload->>'meta_attempt_state' = 'contacting_meta'
      AND delivery.provider_message_id IS NULL THEN NULL
    ELSE COALESCE(delivery.sent_at, delivery.delivered_at, delivery.read_at, delivery.failed_at, now())
  END,
  CASE
    WHEN delivery.provider_message_id IS NOT NULL THEN
      CASE WHEN delivery.status IN ('sent','delivered','read','failed') THEN delivery.status ELSE 'sent' END
    ELSE NULL
  END,
  COALESCE(delivery.read_at, delivery.delivered_at, delivery.sent_at, delivery.failed_at),
  CASE
    WHEN delivery.provider_message_id IS NOT NULL OR delivery.status IN ('sent','delivered','read') THEN NULL
    ELSE COALESCE(delivery.error_code, 'reconciliation_required')
  END,
  CASE
    WHEN delivery.provider_message_id IS NOT NULL OR delivery.status IN ('sent','delivered','read') THEN NULL
    ELSE COALESCE(delivery.error_message, 'Intento Meta legacy materializado durante upgrade 15200')
  END
FROM public.notification_deliveries delivery
JOIN public.notification_events event ON event.id = delivery.notification_event_id
WHERE delivery.channel = 'whatsapp'
  AND delivery.provider = 'meta_cloud_api'
  AND delivery.provider_payload->>'meta_attempt_count' = '1'
  AND delivery.provider_payload ? 'send_started_at'
ON CONFLICT (delivery_id, attempt_no) DO NOTHING;

-- Recupera un worker caído después de begin. El aggregate lock y el row lock del
-- evento cercan a dos workers; el intento 1 abandonado queda durablemente
-- incierto antes de autorizar el único slot restante. Un intento 2 abandonado
-- también se terminaliza, pero nunca abre un slot 3.
CREATE OR REPLACE FUNCTION public.claim_bounded_whatsapp_retry(
  _event_id uuid,
  _lease_token uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_row public.notification_events%ROWTYPE;
  delivery_row public.notification_deliveries%ROWTYPE;
  stale_attempt public.notification_delivery_attempts%ROWTYPE;
  recovering_authorized boolean := false;
  attempt_count integer := 0;
BEGIN
  IF _lease_token IS NULL THEN
    RAISE EXCEPTION 'whatsapp_retry_lease_required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_event_id::text, 20260720)
  );
  SELECT * INTO event_row
  FROM public.notification_events event
  WHERE event.id = _event_id
  FOR UPDATE;

  IF event_row.id IS NULL OR NOT (
    event_row.status = 'failed'
    OR (
      event_row.status = 'processing'
      AND event_row.processed_at < now() - interval '10 minutes'
    )
  ) THEN
    RETURN NULL;
  END IF;

  -- Orden global Meta: advisory(event) -> event -> deliveries(id) ->
  -- attempts(attempt_no,id). Se bloquean también siblings/fallback antes de
  -- evaluar exclusión para que ningún writer observe una mezcla de versiones.
  PERFORM 1
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = _event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT delivery.* INTO delivery_row
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = _event_id
    AND delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api'
    AND delivery.status = 'queued'
  ORDER BY delivery.created_at DESC
  LIMIT 1;
  IF delivery_row.id IS NULL OR delivery_row.provider_message_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notification_deliveries fallback
    WHERE fallback.notification_event_id = _event_id
      AND fallback.channel = 'email'
      AND fallback.template_name = 'task_rejected_admin_fallback_email'
  ) THEN
    RETURN NULL;
  END IF;

  PERFORM 1
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = delivery_row.id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;

  SELECT count(*)::integer INTO attempt_count
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = delivery_row.id;

  SELECT attempt.* INTO stale_attempt
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = delivery_row.id
    AND attempt.state = 'contacting_meta'
    AND attempt.started_at <= now() - interval '15 minutes'
    AND (
      event_row.status = 'failed'
      OR attempt.event_lease_token = event_row.processing_lease_token
    )
  ORDER BY attempt.attempt_no DESC
  LIMIT 1;

  IF stale_attempt.id IS NOT NULL THEN
    UPDATE public.notification_delivery_attempts attempt
    SET state = 'completed_uncertain',
        finalized_at = now(),
        error_code = 'worker_crash_recovered',
        error_message = 'Worker abandonado después de begin; resultado Meta incierto',
        provider_response = COALESCE(attempt.provider_response, '{}'::jsonb)
          || jsonb_build_object('worker_crash_recovered_at', now())
    WHERE attempt.id = stale_attempt.id
      AND attempt.state = 'contacting_meta';

    UPDATE public.notification_deliveries delivery
    SET provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
          || jsonb_build_object('meta_attempt_state', 'completed_uncertain'),
        error_code = 'reconciliation_required',
        error_message = 'Worker abandonado después de begin; resultado Meta incierto'
    WHERE delivery.id = delivery_row.id;
    delivery_row.provider_payload := COALESCE(delivery_row.provider_payload, '{}'::jsonb)
      || jsonb_build_object('meta_attempt_state', 'completed_uncertain');
    delivery_row.error_code := 'reconciliation_required';
  END IF;

  -- El presupuesto ya se consumió por completo. La llamada queda visible como
  -- incierta y el sender cerrará el evento sin contactar Meta por tercera vez.
  IF attempt_count >= 2 THEN
    RETURN NULL;
  END IF;

  recovering_authorized := delivery_row.error_code = 'bounded_retry_authorized'
    AND delivery_row.provider_payload->>'meta_attempt_state' = 'retry_authorized'
    AND delivery_row.provider_payload->>'retry_risk_policy' = 'prioritize_delivery'
    AND event_row.status = 'processing'
    AND event_row.processed_at < now() - interval '10 minutes';

  IF attempt_count <> 1
     OR COALESCE((delivery_row.provider_payload->>'meta_attempt_count')::integer, 1) <> 1
     OR NOT (
       recovering_authorized
       OR (
         delivery_row.error_code = 'reconciliation_required'
         AND delivery_row.provider_payload->>'meta_attempt_state' = 'completed_uncertain'
         AND (delivery_row.provider_payload->>'send_started_at')::timestamptz
           <= now() - interval '15 minutes'
       )
     ) THEN
    RETURN NULL;
  END IF;

  UPDATE public.notification_events event
  SET status = 'processing', processed_at = now(), processing_lease_token = _lease_token,
      error_message = CASE WHEN recovering_authorized
        THEN 'Reintento WhatsApp 2/2 recuperado tras expirar el worker anterior'
        ELSE 'Reintento WhatsApp 2/2 autorizado: política priorizar entrega' END
  WHERE event.id = _event_id;

  UPDATE public.notification_deliveries delivery
  SET provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object(
          'meta_attempt_state', 'retry_authorized',
          'retry_authorized_at', COALESCE(
            delivery.provider_payload->'retry_authorized_at', to_jsonb(now())
          ),
          'retry_recovered_at', CASE WHEN recovering_authorized THEN to_jsonb(now()) ELSE NULL END,
          'retry_risk_policy', 'prioritize_delivery'
        )),
      error_code = 'bounded_retry_authorized',
      error_message = CASE WHEN recovering_authorized
        THEN 'Reintento WhatsApp 2/2 recuperado; existe riesgo excepcional de duplicado'
        ELSE 'Reintento WhatsApp 2/2 autorizado; existe riesgo excepcional de duplicado' END
  WHERE delivery.id = delivery_row.id;

  RETURN delivery_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_bounded_whatsapp_retry(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bounded_whatsapp_retry(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.begin_whatsapp_send_attempt(
  _delivery_id uuid,
  _event_id uuid,
  _lease_token uuid,
  _attempt_token uuid,
  _provider_payload jsonb
)
RETURNS TABLE (attempt_id uuid, attempt_token uuid, attempt_no integer, claimed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_row public.notification_events%ROWTYPE;
  delivery_row public.notification_deliveries%ROWTYPE;
  existing_attempt public.notification_delivery_attempts%ROWTYPE;
  created_attempt public.notification_delivery_attempts%ROWTYPE;
  next_attempt_no integer;
  legacy_attempt_count integer;
BEGIN
  IF _attempt_token IS NULL OR _lease_token IS NULL THEN
    RAISE EXCEPTION 'whatsapp_attempt_tokens_required' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_event_id::text, 20260720)
  );
  SELECT * INTO event_row FROM public.notification_events
  WHERE id = _event_id FOR UPDATE;
  PERFORM 1
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = _event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT * INTO delivery_row FROM public.notification_deliveries
  WHERE id = _delivery_id AND notification_event_id = _event_id;

  IF event_row.id IS NULL OR event_row.status <> 'processing'
     OR event_row.processing_lease_token IS DISTINCT FROM _lease_token
     OR delivery_row.id IS NULL OR delivery_row.channel <> 'whatsapp'
     OR delivery_row.provider <> 'meta_cloud_api'
     OR delivery_row.status <> 'queued' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::integer, false;
    RETURN;
  END IF;

  PERFORM 1
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = _delivery_id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;
  SELECT attempt.* INTO existing_attempt
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = _delivery_id
    AND attempt.state = 'contacting_meta'
  ORDER BY attempt.attempt_no DESC LIMIT 1;
  IF existing_attempt.id IS NOT NULL THEN
    RETURN QUERY SELECT existing_attempt.id, existing_attempt.claim_token,
      existing_attempt.attempt_no::integer, false;
    RETURN;
  END IF;

  legacy_attempt_count := COALESCE((delivery_row.provider_payload->>'meta_attempt_count')::integer, 0);
  SELECT GREATEST(COALESCE(max(attempt.attempt_no), 0), legacy_attempt_count) + 1
  INTO next_attempt_no
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = _delivery_id;

  IF next_attempt_no >= 2 AND next_attempt_no > 2 THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, next_attempt_no, false;
    RETURN;
  END IF;
  IF next_attempt_no = 2 AND NOT (
    delivery_row.provider_payload->>'meta_attempt_state' = 'retry_authorized'
    AND legacy_attempt_count = 1
  ) THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, next_attempt_no, false;
    RETURN;
  END IF;
  IF next_attempt_no = 1 AND COALESCE(delivery_row.provider_payload, '{}'::jsonb) ? 'send_started_at' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, next_attempt_no, false;
    RETURN;
  END IF;

  INSERT INTO public.notification_delivery_attempts (
    delivery_id, attempt_no, claim_token, event_lease_token, state,
    provider_response, started_at
  ) VALUES (
    _delivery_id, next_attempt_no, _attempt_token, _lease_token,
    'contacting_meta', '{}'::jsonb, now()
  ) RETURNING * INTO created_attempt;

  UPDATE public.notification_deliveries delivery
  SET provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
    || (COALESCE(_provider_payload, '{}'::jsonb) - 'buttonPayloads')
    || CASE
      WHEN COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'buttonPayloads'
        THEN jsonb_build_object('buttonPayloads', delivery.provider_payload->'buttonPayloads')
      WHEN COALESCE(_provider_payload, '{}'::jsonb) ? 'buttonPayloads'
        THEN jsonb_build_object('buttonPayloads', _provider_payload->'buttonPayloads')
      ELSE '{}'::jsonb
    END
    || jsonb_build_object(
      'first_send_started_at', COALESCE(
        delivery.provider_payload->'first_send_started_at', to_jsonb(created_attempt.started_at)
      ),
      'send_started_at', created_attempt.started_at,
      'meta_attempt_count', next_attempt_no,
      'meta_attempt_state', 'contacting_meta',
      'send_lease_token', _lease_token,
      'send_attempt_id', created_attempt.id,
      'retry_risk_policy', CASE WHEN next_attempt_no = 2
        THEN 'prioritize_delivery' ELSE 'none' END
    ), error_code = NULL,
    error_message = CASE WHEN next_attempt_no = 2
      THEN 'Ejecutando reintento WhatsApp 2/2; riesgo excepcional de duplicado aceptado'
      ELSE NULL END
  WHERE delivery.id = _delivery_id;

  RETURN QUERY SELECT created_attempt.id, created_attempt.claim_token,
    created_attempt.attempt_no::integer, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_whatsapp_send_attempt(
  _attempt_id uuid,
  _attempt_token uuid,
  _provider_message_id text,
  _provider_response jsonb,
  _sent_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  attempt_row public.notification_delivery_attempts%ROWTYPE;
  delivery_row public.notification_deliveries%ROWTYPE;
  event_row public.notification_events%ROWTYPE;
  locked_event_id uuid;
BEGIN
  IF COALESCE(btrim(_provider_message_id), '') = '' THEN
    RAISE EXCEPTION 'provider_message_id_required' USING ERRCODE = '22023';
  END IF;
  SELECT delivery.notification_event_id INTO locked_event_id
  FROM public.notification_delivery_attempts attempt
  JOIN public.notification_deliveries delivery ON delivery.id = attempt.delivery_id
  WHERE attempt.id = _attempt_id;
  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_attempt_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );
  SELECT * INTO event_row FROM public.notification_events
  WHERE id = locked_event_id FOR UPDATE;
  IF event_row.id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_attempt_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = locked_event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT * INTO delivery_row FROM public.notification_deliveries
  WHERE notification_event_id = locked_event_id
    AND id = (SELECT attempt.delivery_id FROM public.notification_delivery_attempts attempt
              WHERE attempt.id = _attempt_id);
  IF delivery_row.id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_attempt_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = delivery_row.id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;
  SELECT * INTO attempt_row FROM public.notification_delivery_attempts
  WHERE id = _attempt_id;

  IF attempt_row.claim_token IS DISTINCT FROM _attempt_token THEN
    RAISE EXCEPTION 'stale_whatsapp_attempt_generation' USING ERRCODE = '22023';
  END IF;
  IF attempt_row.state = 'accepted'
     AND attempt_row.provider_message_id = _provider_message_id THEN
    RETURN delivery_row.status;
  END IF;
  IF attempt_row.state <> 'contacting_meta' THEN
    RAISE EXCEPTION 'stale_whatsapp_attempt_generation' USING ERRCODE = '22023';
  END IF;

  -- Un botón firmado con nonce puede haber atribuido provisionalmente el ID del
  -- intento síncrono al slot anterior. Solo el token de finalize demuestra qué
  -- POST devolvió ese ID; los status desconocidos jamás llegan a este camino.
  UPDATE public.notification_delivery_attempts other
  SET provider_message_id = NULL,
      correlation_source = NULL,
      state = CASE WHEN other.attempt_no = 1 THEN 'completed_uncertain' ELSE other.state END
  WHERE other.delivery_id = attempt_row.delivery_id
    AND other.id <> attempt_row.id
    AND other.provider_message_id = _provider_message_id
    AND other.correlation_source = 'button_callback';

  UPDATE public.notification_delivery_attempts attempt
  SET provider_message_id = _provider_message_id,
      provider_response = COALESCE(attempt.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      state = 'accepted', correlation_source = 'sync_response',
      finalized_at = COALESCE(_sent_at, now()), last_status = 'sent',
      status_occurred_at = COALESCE(_sent_at, now()), error_code = NULL, error_message = NULL
  WHERE attempt.id = _attempt_id;

  UPDATE public.notification_deliveries delivery
  SET provider_message_id = _provider_message_id,
      status = CASE WHEN delivery.status = 'queued' THEN 'sent' ELSE delivery.status END,
      provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      sent_at = COALESCE(delivery.sent_at, _sent_at, now()),
      error_code = CASE WHEN delivery.status = 'queued' THEN NULL ELSE delivery.error_code END,
      error_message = CASE WHEN delivery.status = 'queued' THEN NULL ELSE delivery.error_message END
  WHERE delivery.id = attempt_row.delivery_id;

  -- Un status firmado puede llegar antes de la respuesta síncrona. Hasta este
  -- punto quedó pending/unmatched por provider ID; ahora se reproduce por ID
  -- exacto dentro de la misma transacción, nunca por teléfono.
  PERFORM replay.callback_id
  FROM public.replay_whatsapp_status_callbacks(_provider_message_id) replay;

  SELECT delivery.status INTO delivery_row.status
  FROM public.notification_deliveries delivery
  WHERE delivery.id = attempt_row.delivery_id;
  RETURN delivery_row.status;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_whatsapp_send_attempt_uncertain(
  _attempt_id uuid,
  _attempt_token uuid,
  _provider_response jsonb,
  _error_message text
)
RETURNS TABLE (effective_status text, provider_message_id text, reconciliation_required boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  attempt_row public.notification_delivery_attempts%ROWTYPE;
  delivery_row public.notification_deliveries%ROWTYPE;
  event_row public.notification_events%ROWTYPE;
  locked_event_id uuid;
  locked_delivery_id uuid;
  result_row record;
BEGIN
  SELECT attempt.delivery_id, delivery.notification_event_id
  INTO locked_delivery_id, locked_event_id
  FROM public.notification_delivery_attempts attempt
  JOIN public.notification_deliveries delivery ON delivery.id = attempt.delivery_id
  WHERE attempt.id = _attempt_id;
  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'stale_whatsapp_attempt_generation' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );
  SELECT * INTO event_row FROM public.notification_events
  WHERE id = locked_event_id FOR UPDATE;
  PERFORM 1
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = locked_event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT * INTO delivery_row FROM public.notification_deliveries
  WHERE id = locked_delivery_id AND notification_event_id = locked_event_id;
  PERFORM 1
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = locked_delivery_id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;
  SELECT * INTO attempt_row FROM public.notification_delivery_attempts
  WHERE id = _attempt_id AND delivery_id = locked_delivery_id;
  IF attempt_row.id IS NULL OR attempt_row.claim_token IS DISTINCT FROM _attempt_token THEN
    RAISE EXCEPTION 'stale_whatsapp_attempt_generation' USING ERRCODE = '22023';
  END IF;
  IF attempt_row.state = 'contacting_meta' THEN
    UPDATE public.notification_delivery_attempts attempt
    SET state = 'completed_uncertain', finalized_at = now(),
        provider_response = COALESCE(attempt.provider_response, '{}'::jsonb)
          || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
        error_code = 'reconciliation_required', error_message = left(_error_message, 1000)
    WHERE attempt.id = _attempt_id;
  END IF;
  SELECT * INTO result_row FROM public.finalize_uncertain_whatsapp_send_delivery(
    attempt_row.delivery_id, attempt_row.event_lease_token, _provider_response, _error_message
  );
  RETURN QUERY SELECT result_row.effective_status, result_row.provider_message_id,
    result_row.reconciliation_required;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_whatsapp_send_attempt_non_delivery(
  _attempt_id uuid,
  _attempt_token uuid,
  _result_status text,
  _provider_response jsonb,
  _error_code text,
  _error_message text
)
RETURNS TABLE (effective_status text, provider_message_id text, reconciliation_required boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  attempt_row public.notification_delivery_attempts%ROWTYPE;
  delivery_row public.notification_deliveries%ROWTYPE;
  event_row public.notification_events%ROWTYPE;
  locked_event_id uuid;
  locked_delivery_id uuid;
  result_row record;
BEGIN
  SELECT attempt.delivery_id, delivery.notification_event_id
  INTO locked_delivery_id, locked_event_id
  FROM public.notification_delivery_attempts attempt
  JOIN public.notification_deliveries delivery ON delivery.id = attempt.delivery_id
  WHERE attempt.id = _attempt_id;
  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'stale_whatsapp_attempt_generation' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );
  SELECT * INTO event_row FROM public.notification_events
  WHERE id = locked_event_id FOR UPDATE;
  PERFORM 1
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = locked_event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT * INTO delivery_row FROM public.notification_deliveries
  WHERE id = locked_delivery_id AND notification_event_id = locked_event_id;
  PERFORM 1
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = locked_delivery_id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;
  SELECT * INTO attempt_row FROM public.notification_delivery_attempts
  WHERE id = _attempt_id AND delivery_id = locked_delivery_id;
  IF attempt_row.id IS NULL OR attempt_row.claim_token IS DISTINCT FROM _attempt_token
     OR attempt_row.state <> 'contacting_meta' THEN
    RAISE EXCEPTION 'stale_whatsapp_attempt_generation' USING ERRCODE = '22023';
  END IF;
  UPDATE public.notification_delivery_attempts attempt
  SET state = 'failed', finalized_at = now(), last_status = _result_status,
      provider_response = COALESCE(attempt.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      error_code = NULLIF(left(COALESCE(_error_code, ''), 255), ''),
      error_message = NULLIF(left(COALESCE(_error_message, ''), 1000), '')
  WHERE attempt.id = _attempt_id;
  SELECT * INTO result_row FROM public.finalize_whatsapp_non_delivery_result(
    attempt_row.delivery_id, attempt_row.event_lease_token, _result_status,
    _provider_response, _error_code, _error_message
  );
  RETURN QUERY SELECT result_row.effective_status, result_row.provider_message_id,
    result_row.reconciliation_required;
END;
$$;

CREATE OR REPLACE FUNCTION public.bind_whatsapp_delivery_from_status(
  _provider_message_id text,
  _recipient text,
  _occurred_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_delivery_id uuid;
BEGIN
  IF COALESCE(btrim(_provider_message_id), '') = '' OR _occurred_at IS NULL THEN
    RETURN NULL;
  END IF;

  -- _recipient se conserva por compatibilidad de firma, pero nunca participa en
  -- la correlación. Un ID desconocido permanece unmatched en webhook_inbox.
  SELECT attempt.delivery_id INTO target_delivery_id
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.provider_message_id = _provider_message_id;

  IF target_delivery_id IS NULL THEN
    SELECT delivery.id INTO target_delivery_id
    FROM public.notification_deliveries delivery
    WHERE delivery.channel = 'whatsapp'
      AND delivery.provider = 'meta_cloud_api'
      AND delivery.provider_message_id = _provider_message_id;
  END IF;

  RETURN target_delivery_id;
END;
$$;

-- Aplica estados usando cualquiera de las identidades remotas A/B conservadas
-- en attempt history. La correlación sigue siendo exclusivamente por provider ID;
-- nunca consulta recipient/teléfono.
CREATE OR REPLACE FUNCTION public.apply_whatsapp_delivery_status(
  _provider_message_id text,
  _status text,
  _occurred_at timestamptz,
  _error_message text DEFAULT NULL
)
RETURNS TABLE (
  delivery_id uuid,
  notification_event_id uuid,
  applied boolean,
  effective_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.notification_deliveries%ROWTYPE;
  event_row public.notification_events%ROWTYPE;
  target_delivery_id uuid;
  locked_event_id uuid;
  current_rank integer;
  incoming_rank integer;
  current_occurred_at timestamptz;
  successful_whatsapp boolean;
BEGIN
  IF COALESCE(btrim(_provider_message_id), '') = '' THEN
    RAISE EXCEPTION 'provider_message_id_required' USING ERRCODE = '22023';
  END IF;
  IF _status NOT IN ('sent', 'delivered', 'read', 'failed') THEN
    RAISE EXCEPTION 'unsupported_whatsapp_status' USING ERRCODE = '22023';
  END IF;

  SELECT delivery.id, delivery.notification_event_id
  INTO target_delivery_id, locked_event_id
  FROM public.notification_deliveries delivery
  WHERE delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api'
    AND (
      delivery.provider_message_id = _provider_message_id
      OR EXISTS (
        SELECT 1
        FROM public.notification_delivery_attempts attempt
        WHERE attempt.delivery_id = delivery.id
          AND attempt.provider_message_id = _provider_message_id
      )
    );
  IF locked_event_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );
  SELECT * INTO event_row
  FROM public.notification_events event
  WHERE event.id = locked_event_id
  FOR UPDATE;
  IF event_row.id IS NULL THEN
    RETURN;
  END IF;
  PERFORM 1
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = locked_event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT delivery.* INTO target
  FROM public.notification_deliveries delivery
  WHERE delivery.id = target_delivery_id
    AND delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api';
  IF NOT FOUND OR target.notification_event_id <> locked_event_id THEN
    RETURN;
  END IF;
  PERFORM 1
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = target.id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;

  IF target.status = 'failed' AND _status <> 'failed' THEN
    RETURN QUERY SELECT target.id, target.notification_event_id, false, target.status;
    RETURN;
  END IF;

  current_rank := CASE target.status
    WHEN 'queued' THEN 0 WHEN 'sent' THEN 1 WHEN 'failed' THEN 2
    WHEN 'undeliverable' THEN 2 WHEN 'delivered' THEN 3 WHEN 'read' THEN 4 ELSE 0 END;
  incoming_rank := CASE _status
    WHEN 'sent' THEN 1 WHEN 'failed' THEN 2 WHEN 'delivered' THEN 3 WHEN 'read' THEN 4 END;
  IF COALESCE(target.provider_response->>'whatsapp_status_occurred_at', '')
      ~ '^\d{4}-\d{2}-\d{2}T' THEN
    current_occurred_at := (target.provider_response->>'whatsapp_status_occurred_at')::timestamptz;
  END IF;

  IF (
       current_occurred_at IS NOT NULL
       AND (
         _occurred_at < current_occurred_at
         OR (_occurred_at = current_occurred_at AND incoming_rank <= current_rank)
       )
     ) OR incoming_rank < current_rank THEN
    RETURN QUERY SELECT target.id, target.notification_event_id, false, target.status;
    RETURN;
  END IF;

  UPDATE public.notification_deliveries delivery
  SET status = _status,
      provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
        || jsonb_build_object(
          'whatsapp_status', _status,
          'whatsapp_status_occurred_at', _occurred_at,
          'whatsapp_status_provider_message_id', _provider_message_id
        ),
      sent_at = CASE WHEN _status='sent' THEN COALESCE(delivery.sent_at,_occurred_at) ELSE delivery.sent_at END,
      delivered_at = CASE WHEN _status='delivered' THEN COALESCE(delivery.delivered_at,_occurred_at) ELSE delivery.delivered_at END,
      read_at = CASE WHEN _status='read' THEN COALESCE(delivery.read_at,_occurred_at) ELSE delivery.read_at END,
      failed_at = CASE WHEN _status='failed' THEN COALESCE(delivery.failed_at,_occurred_at) ELSE delivery.failed_at END,
      error_code = CASE WHEN _status='failed' THEN 'meta_delivery_failed' ELSE NULL END,
      error_message = CASE WHEN _status='failed'
        THEN left(COALESCE(_error_message,'Meta informó de un fallo'),1000) ELSE NULL END
  WHERE delivery.id = target.id;

  UPDATE public.notification_delivery_attempts attempt
  SET last_status = _status,
      status_occurred_at = _occurred_at,
      error_code = CASE WHEN _status='failed' THEN 'meta_delivery_failed' ELSE attempt.error_code END,
      error_message = CASE WHEN _status='failed'
        THEN left(COALESCE(_error_message,'Meta informó de un fallo'),1000) ELSE attempt.error_message END
  WHERE attempt.delivery_id = target.id
    AND attempt.provider_message_id = _provider_message_id;

  SELECT EXISTS (
    SELECT 1 FROM public.notification_deliveries sibling
    WHERE sibling.notification_event_id = target.notification_event_id
      AND sibling.channel='whatsapp' AND sibling.provider='meta_cloud_api'
      AND sibling.status IN ('sent','delivered','read')
  ) INTO successful_whatsapp;

  UPDATE public.notification_events event
  SET status = CASE
        WHEN event.status='cancelled' THEN 'cancelled'
        WHEN _status IN ('sent','delivered','read') THEN 'sent'
        WHEN successful_whatsapp THEN 'sent'
        WHEN EXISTS (
          SELECT 1 FROM public.notification_deliveries fallback
          WHERE fallback.notification_event_id=target.notification_event_id
            AND fallback.channel='email'
            AND fallback.template_name='task_rejected_admin_fallback_email'
            AND fallback.status='sent'
        ) THEN 'sent'
        ELSE 'failed' END,
      processed_at = now(),
      error_message = CASE
        WHEN event.status='cancelled' OR _status IN ('sent','delivered','read') OR successful_whatsapp THEN NULL
        WHEN EXISTS (
          SELECT 1 FROM public.notification_deliveries fallback
          WHERE fallback.notification_event_id=target.notification_event_id
            AND fallback.channel='email'
            AND fallback.template_name='task_rejected_admin_fallback_email'
            AND fallback.status='sent'
        ) THEN 'WhatsApp falló; correo de respaldo enviado'
        ELSE left(COALESCE(_error_message,'Meta informó de un fallo'),1000) END
  WHERE event.id = target.notification_event_id;

  RETURN QUERY SELECT target.id, target.notification_event_id, true, _status;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_whatsapp_delivery_status(text,text,timestamptz,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_whatsapp_delivery_status(text,text,timestamptz,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.bind_whatsapp_delivery_from_button(
  _source_provider_message_id text,
  _sender text,
  _button_payload text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate_ids uuid[];
  target_delivery_id uuid;
  target_attempt_id uuid;
  locked_event_id uuid;
  event_row public.notification_events%ROWTYPE;
  delivery_row public.notification_deliveries%ROWTYPE;
  normalized_sender text;
BEGIN
  normalized_sender:=regexp_replace(COALESCE(_sender,''),'[^0-9]','','g');
  IF COALESCE(btrim(_source_provider_message_id),'')='' OR normalized_sender=''
     OR COALESCE(btrim(_button_payload),'')='' THEN RETURN NULL; END IF;
  SELECT attempt.delivery_id INTO target_delivery_id FROM public.notification_delivery_attempts attempt
  WHERE attempt.provider_message_id=_source_provider_message_id;
  IF target_delivery_id IS NULL THEN
    SELECT delivery.id INTO target_delivery_id FROM public.notification_deliveries delivery
    WHERE delivery.channel='whatsapp' AND delivery.provider='meta_cloud_api'
      AND delivery.provider_message_id=_source_provider_message_id;
  END IF;
  IF target_delivery_id IS NULL THEN
    SELECT array_agg(DISTINCT delivery.id ORDER BY delivery.id) INTO candidate_ids
    FROM public.notification_deliveries delivery
    JOIN public.notification_delivery_attempts attempt ON attempt.delivery_id=delivery.id
    WHERE delivery.channel='whatsapp' AND delivery.provider='meta_cloud_api'
      AND delivery.status IN ('queued','sent','delivered','read')
      AND regexp_replace(delivery.recipient,'[^0-9]','','g')=normalized_sender
      AND COALESCE(delivery.provider_payload->'buttonPayloads','[]'::jsonb)?_button_payload;
    IF cardinality(COALESCE(candidate_ids,'{}'::uuid[]))=1 THEN target_delivery_id:=candidate_ids[1]; END IF;
  END IF;
  IF target_delivery_id IS NULL THEN RETURN NULL; END IF;
  SELECT notification_event_id INTO locked_event_id FROM public.notification_deliveries WHERE id=target_delivery_id;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(locked_event_id::text,20260720));
  SELECT * INTO event_row FROM public.notification_events event
  WHERE event.id=locked_event_id FOR UPDATE;
  IF event_row.id IS NULL THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id=locked_event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT * INTO delivery_row FROM public.notification_deliveries delivery
  WHERE delivery.id=target_delivery_id AND delivery.notification_event_id=locked_event_id;
  IF delivery_row.id IS NULL THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id=target_delivery_id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.notification_delivery_attempts attempt
                 WHERE attempt.provider_message_id=_source_provider_message_id) THEN
    SELECT attempt.id INTO target_attempt_id FROM public.notification_delivery_attempts attempt
    WHERE attempt.delivery_id=target_delivery_id AND attempt.provider_message_id IS NULL
    ORDER BY attempt.attempt_no, attempt.id LIMIT 1;
    IF target_attempt_id IS NOT NULL THEN
      UPDATE public.notification_delivery_attempts SET
        provider_message_id=_source_provider_message_id, correlation_source='button_callback',
        state='callback_observed', last_status='sent', status_occurred_at=now()
      WHERE id=target_attempt_id;
    END IF;
  END IF;
  UPDATE public.notification_deliveries delivery SET
    provider_message_id=_source_provider_message_id,
    status=CASE WHEN delivery.status='queued' THEN 'sent' ELSE delivery.status END,
    sent_at=COALESCE(delivery.sent_at,now()), error_code=NULL,error_message=NULL,
    provider_response=COALESCE(delivery.provider_response,'{}'::jsonb)
      ||jsonb_build_object('reconciled_from_attempt_button',true)
  WHERE delivery.id=target_delivery_id;
  UPDATE public.notification_events event SET
    status=CASE WHEN event.status='cancelled' THEN 'cancelled' ELSE 'sent' END,
    processed_at=now(),error_message=CASE WHEN event.status='cancelled' THEN event.error_message ELSE NULL END
  WHERE event.id=locked_event_id;
  RETURN target_delivery_id;
EXCEPTION WHEN unique_violation THEN
  SELECT attempt.delivery_id INTO target_delivery_id FROM public.notification_delivery_attempts attempt
  WHERE attempt.provider_message_id=_source_provider_message_id;
  RETURN target_delivery_id;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_whatsapp_send_attempt(uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalize_whatsapp_send_attempt(uuid,uuid,text,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalize_whatsapp_send_attempt_uncertain(uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalize_whatsapp_send_attempt_non_delivery(uuid,uuid,text,jsonb,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bind_whatsapp_delivery_from_status(text,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bind_whatsapp_delivery_from_button(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_whatsapp_send_attempt(uuid,uuid,uuid,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_whatsapp_send_attempt(uuid,uuid,text,jsonb,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_whatsapp_send_attempt_uncertain(uuid,uuid,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_whatsapp_send_attempt_non_delivery(uuid,uuid,text,jsonb,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bind_whatsapp_delivery_from_status(text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.bind_whatsapp_delivery_from_button(text,text,text) TO service_role;

COMMENT ON TABLE public.notification_delivery_attempts IS
  'Historial inmutable one-to-many de los dos POST Meta permitidos por delivery lógica.';
